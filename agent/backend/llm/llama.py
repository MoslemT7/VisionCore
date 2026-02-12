import os
import logging
from typing import Optional, Tuple
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

logger = logging.getLogger(__name__)

# Model configuration
MODEL_NAME = "meta-llama/Llama-2-7b-chat-hf"
DEFAULT_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "llama2")
MAX_NEW_TOKENS = 512
TEMPERATURE = 0.1

# Global model and tokenizer instances (lazy loaded)
_model = None
_tokenizer = None


def get_hf_token() -> Optional[str]:
    """Get Hugging Face token from environment variable or config."""
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
    if not token:
        logger.warning("HF_TOKEN not found in environment. Model download may fail.")
    return token


def load_llama_model(
    model_name: str = MODEL_NAME,
    cache_dir: Optional[str] = None,
    hf_token: Optional[str] = None,
    device_map: str = "auto"
) -> Tuple[AutoModelForCausalLM, AutoTokenizer]:
    """
    Load LLaMA2-7B-chat model and tokenizer locally.
    
    Args:
        model_name: Hugging Face model identifier
        cache_dir: Directory to cache the model (default: models/llama2)
        hf_token: Hugging Face authentication token
        device_map: Device mapping strategy ("auto", "cpu", "cuda", etc.)
    
    Returns:
        Tuple of (model, tokenizer)
    
    Raises:
        RuntimeError: If model loading fails
    """
    global _model, _tokenizer
    
    if _model is not None and _tokenizer is not None:
        logger.info("Model already loaded, reusing existing instance")
        return _model, _tokenizer
    
    if cache_dir is None:
        cache_dir = DEFAULT_CACHE_DIR
    os.makedirs(cache_dir, exist_ok=True)
    
    if hf_token is None:
        hf_token = get_hf_token()
    
    if not hf_token:
        raise RuntimeError(
            "Hugging Face token required. Set HF_TOKEN environment variable or pass hf_token parameter."
        )
    
    try:
        logger.info(f"Loading tokenizer for {model_name}...")
        _tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            token=hf_token,
            cache_dir=cache_dir,
            local_files_only=False
        )
        
        # Set pad token if not present
        if _tokenizer.pad_token is None:
            _tokenizer.pad_token = _tokenizer.eos_token
        
        logger.info(f"Loading model {model_name} with device_map={device_map}...")
        _model = AutoModelForCausalLM.from_pretrained(
            model_name,
            token=hf_token,
            cache_dir=cache_dir,
            device_map=device_map,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True,
            local_files_only=False
        )
        
        logger.info(f"Model loaded successfully. Device: {device_map}")
        return _model, _tokenizer
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError(f"Model loading failed: {e}") from e


def generate_summary(
    prompt: str,
    model_name: str = MODEL_NAME,
    max_new_tokens: int = MAX_NEW_TOKENS,
    temperature: float = TEMPERATURE,
    hf_token: Optional[str] = None
) -> str:
    """
    Generate a text summary using the local LLaMA model.
    
    Args:
        prompt: Input prompt text
        model_name: Model identifier
        max_new_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        hf_token: Hugging Face token
    
    Returns:
        Generated text summary
    """
    try:
        model, tokenizer = load_llama_model(model_name=model_name, hf_token=hf_token)
        
        # Format prompt with LLaMA2 chat template
        messages = [{"role": "user", "content": prompt}]
        formatted_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        
        # Tokenize
        inputs = tokenizer(formatted_prompt, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to(model.device) for k, v in inputs.items()}
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        # Decode response (skip the prompt)
        response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        return response.strip()
        
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        raise RuntimeError(f"Failed to generate summary: {e}") from e
