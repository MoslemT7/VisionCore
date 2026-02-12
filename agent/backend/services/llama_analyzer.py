import json
import logging
from typing import Dict, List, Any, Optional
from collections import Counter

from llm.llama import generate_summary, get_hf_token

logger = logging.getLogger(__name__)


class LlamaAnalyzer:
    """
    Analyzer using local LLaMA2-7B-chat model for video analysis summaries.
    """
    
    def __init__(self, hf_token: Optional[str] = None):
        """
        Initialize the LLaMA analyzer.
        
        Args:
            hf_token: Hugging Face authentication token (optional, will use env var if not provided)
        """
        self.hf_token = hf_token or get_hf_token()
        if not self.hf_token:
            logger.warning("No HF token provided. Model loading will fail if not cached.")
    
    def analyze_detections(
        self,
        detections_all: List[Dict[str, Any]],
        energy_wh: float,
        max_frames: int = 50
    ) -> str:
        """
        Generate a concise textual summary of video detections using LLaMA.
        
        Args:
            detections_all: List of frame detection dictionaries
            energy_wh: Energy consumption in Wh
            max_frames: Maximum number of frames to include in prompt (for token efficiency)
        
        Returns:
            Textual summary string
        """
        try:
            # Limit frames for token efficiency
            limited_frames = detections_all[:max_frames]
            
            # Build compact frame summary
            frame_summaries = []
            for frame_data in limited_frames:
                frame_num = frame_data.get("frame", 0)
                timestamp = frame_data.get("timestamp", 0.0)
                detections = frame_data.get("detections", [])
                
                if detections:
                    # Aggregate objects per frame (avoid repetition)
                    objects = [det.get("class_name", "unknown") for det in detections]
                    unique_objects = list(set(objects))  # Remove duplicates
                    obj_str = ", ".join(unique_objects)
                    frame_summaries.append(f"Frame {frame_num} ({timestamp:.1f}s): {obj_str}")
            
            # Build prompt
            frames_text = "\n".join(frame_summaries) if frame_summaries else "No detections in sampled frames."
            
            prompt = f"""You are a video analysis AI. Analyze the following object detections from video footage and generate a concise, readable summary.

Frame-by-frame detections:
{frames_text}

Total frames processed: {len(detections_all)}
Energy consumed: {energy_wh:.4f} Wh

Generate a brief, structured summary (2-3 sentences) describing:
1. The main objects/activities observed
2. Any notable patterns or events
3. Overall scene description

Keep it concise and informative."""

            summary = generate_summary(
                prompt=prompt,
                hf_token=self.hf_token,
                max_new_tokens=256,  # Keep summary short
                temperature=0.1
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            # Fallback to rule-based summary
            return self._fallback_summary(detections_all, energy_wh)
    
    def _fallback_summary(self, detections_all: List[Dict[str, Any]], energy_wh: float) -> str:
        """Generate a simple rule-based summary if LLM fails."""
        total_frames = len(detections_all)
        all_objects = []
        
        for frame_data in detections_all:
            for det in frame_data.get("detections", []):
                all_objects.append(det.get("class_name", "unknown"))
        
        if not all_objects:
            return f"Processed {total_frames} frames. No objects detected. Energy: {energy_wh:.4f} Wh."
        
        counter = Counter(all_objects)
        top_objects = counter.most_common(5)
        top_str = ", ".join(f"{name} ({count})" for name, count in top_objects)
        
        return f"Processed {total_frames} frames with {len(all_objects)} total detections. Most common: {top_str}. Energy: {energy_wh:.4f} Wh."

