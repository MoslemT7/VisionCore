from ollama import chat  # lowercase

class LLMAnalyzer:
    def __init__(self, model="llama3-8b"):
        self.model_name = model

    def analyze_events(self, detections_json_path):
        import json

        with open(detections_json_path, "r") as f:
            events = json.load(f)

        prompt = self._build_prompt(events)

        # Directly call chat() function
        response = chat(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}]
        )

        # The response is a dict, usually {'id':..., 'object':..., 'content':...}
        return response.get("content", "No summary generated")

    def _build_prompt(self, events):
        summary_lines = []
        for frame in events[:50]:  # limit frames to reduce tokens
            objects = [obj["class_name"] for obj in frame["detections"]]
            if objects:
                summary_lines.append(f"{frame['frame']}: {', '.join(objects)} detected")

        return f"""
You are a video analysis AI.
Analyze these events and generate a concise report about the footage content:
{chr(10).join(summary_lines)}
Return structured, readable text summarizing activity and important events.
"""
