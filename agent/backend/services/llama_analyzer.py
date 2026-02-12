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

    def analyze_story(
        self,
        detections_all: List[Dict[str, Any]],
        tracks: List[Dict[str, Any]],
        energy_wh: float,
        max_frames: int = 60,
    ) -> str:
        """
        Generate a narrative, human-like story summary based primarily on tracked objects.
        Falls back to analyze_detections() if anything goes wrong.
        """
        try:
            prompt = self._build_story_prompt(detections_all=detections_all, tracks=tracks, energy_wh=energy_wh, max_frames=max_frames)
            story = generate_summary(
                prompt=prompt,
                hf_token=self.hf_token,
                max_new_tokens=384,
                temperature=0.2,
            )
            return story.strip()
        except Exception as e:
            logger.error(f"LLM story analysis failed: {e}")
            return self.analyze_detections(detections_all=detections_all, energy_wh=energy_wh, max_frames=min(max_frames, 50))

    def _build_story_prompt(
        self,
        detections_all: List[Dict[str, Any]],
        tracks: List[Dict[str, Any]],
        energy_wh: float,
        max_frames: int,
    ) -> str:
        total_frames = len(detections_all)
        if total_frames == 0:
            return (
                "You are an intelligent video scene analyst.\n\n"
                "No frames were processed. Write a short explanation that the footage could not be analyzed.\n"
            )

        # Keep prompt compact: focus on tracks + a light timeline sample.
        track_lines: List[str] = []
        for tr in sorted(tracks, key=lambda t: float(t.get("first_seen_timestamp", 0.0))):
            cls = tr.get("class_name", "object")
            tid = tr.get("track_id", "unknown")
            t0 = float(tr.get("first_seen_timestamp", 0.0))
            t1 = float(tr.get("last_seen_timestamp", 0.0))
            frames_seen = int(tr.get("frames_seen", 0))

            # Movement estimate from path endpoints
            path = tr.get("path") or []
            movement = ""
            if len(path) >= 2:
                _, x0, y0 = path[0]
                _, x1, y1 = path[-1]
                dist = ((float(x1) - float(x0)) ** 2 + (float(y1) - float(y0)) ** 2) ** 0.5
                if dist > 150:
                    movement = " It moves noticeably across the scene."
                elif dist > 50:
                    movement = " It shifts position within the scene."

            track_lines.append(
                f"- {cls}#{tid}: visible from ~{t0:.1f}s to ~{t1:.1f}s (seen in {frames_seen} sampled frames).{movement}"
            )

        # Sample a few frames for "beats" (avoid token blow-up)
        sampled = detections_all
        if len(sampled) > max_frames:
            step = max(1, len(sampled) // max_frames)
            sampled = sampled[::step]

        beat_lines: List[str] = []
        for frame in sampled[:20]:
            ts = float(frame.get("timestamp", 0.0))
            dets = frame.get("detections", [])
            if not dets:
                continue
            names = []
            for d in dets:
                cls = d.get("class_name", "object")
                tid = d.get("track_id")
                names.append(f"{cls}#{tid}" if tid is not None else cls)
            # keep unique but stable-ish order
            seen = set()
            uniq = [n for n in names if not (n in seen or seen.add(n))]
            beat_lines.append(f"- ~{ts:.1f}s: {', '.join(uniq[:6])}")
            if len(beat_lines) >= 8:
                break

        tracks_text = "\n".join(track_lines) if track_lines else "- No tracked objects were detected."
        beats_text = "\n".join(beat_lines) if beat_lines else "- No notable beats in sampled frames."

        return f"""You are an intelligent video scene analyst and storyteller.

You are given tracked-object data extracted from a video (objects may have stable IDs like person#12).

Tracked objects:
{tracks_text}

Scene beats (coarse timeline samples):
{beats_text}

Constraints:
- Write a natural, human-like narrative of what happens in the footage (5-8 sentences).
- Do NOT list statistics or counts.
- Do NOT mention internal implementation details, model names, or energy usage.
- You may refer to subjects consistently using their IDs when it helps clarity (e.g., "person#12"), but keep it readable.

Write the story now."""
    
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

