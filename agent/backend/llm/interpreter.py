import json
import requests
from typing import Dict, Optional
import yaml


class QueryInterpreter:
    def __init__(self, provider: str = "ollama", model: str = "llama3.2:1b", base_url: str = "http://localhost:11434"):
        self.provider = provider
        self.model = model
        self.base_url = base_url
        self.temperature = 0.1
        self.max_tokens = 512
    
    def interpret(self, query: str) -> Dict:
        prompt = f"""Convert this natural language query into a structured JSON task.

Query: {query}

Output ONLY valid JSON in this format:
{{
  "task": "count|detect|analyze",
  "target": "person|object",
  "filters": {{
    "clothing_color": "red|blue|green|etc",
    "height": "tall|short|medium"
  }},
  "action": "what the user wants to do"
}}

If no filters apply, use empty object {{}} for filters.
"""
        
        if self.provider == "ollama":
            return self._call_ollama(prompt)
        else:
            return self._fallback_parse(query)
    
    def _call_ollama(self, prompt: str) -> Dict:
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.temperature,
                        "num_predict": self.max_tokens
                    }
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                text = result.get("response", "")
                return self._extract_json(text)
        except Exception:
            pass
        
        return self._fallback_parse(prompt)
    
    def _extract_json(self, text: str) -> Dict:
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)
        except Exception:
            pass
        
        return self._fallback_parse(text)
    
    def _fallback_parse(self, query: str) -> Dict:
        query_lower = query.lower()
        
        task = "detect"
        if "count" in query_lower:
            task = "count"
        elif "analyze" in query_lower or "what" in query_lower:
            task = "analyze"
        
        filters = {}
        
        colors = ["red", "blue", "green", "yellow", "orange", "purple", "black", "white"]
        for color in colors:
            if color in query_lower:
                filters["clothing_color"] = color
                break
        
        if "tall" in query_lower:
            filters["height"] = "tall"
        elif "short" in query_lower:
            filters["height"] = "short"
        
        return {
            "task": task,
            "target": "person",
            "filters": filters,
            "action": query
        }
    
    def reason(self, query: str, vision_results: Dict) -> str:
        prompt = f"""Based on the vision analysis results, answer this question concisely.

Question: {query}

Vision Results:
{json.dumps(vision_results, indent=2)}

Provide a brief, factual answer."""
        
        if self.provider == "ollama":
            try:
                response = requests.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": self.temperature,
                            "num_predict": 256
                        }
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", "Unable to process query.")
            except Exception:
                pass
        
        return self._fallback_reason(query, vision_results)
    
    def _fallback_reason(self, query: str, vision_results: Dict) -> str:
        count = vision_results.get("count", 0)
        detections = vision_results.get("detections", [])
        
        query_lower = query.lower()
        
        if "count" in query_lower or "how many" in query_lower:
            return f"Found {count} person(s)."
        
        if "color" in query_lower:
            colors = [d.get("attributes", {}).get("dominant_color", "unknown") for d in detections]
            unique_colors = list(set(colors))
            return f"Detected colors: {', '.join(unique_colors)}."
        
        return f"Analysis complete. {count} person(s) detected."

