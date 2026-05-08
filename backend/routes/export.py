import io
import os
import zipfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services.history_service import get_record_by_job_id

router = APIRouter(prefix="/analysis", tags=["export"])

OUTPUTS_DIR = "outputs"

@router.get("/{job_id}/export")
async def export_analysis(job_id: str):

    record = await get_record_by_job_id(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed yet")

    output_dir = os.path.join(OUTPUTS_DIR, job_id)
    if not os.path.isdir(output_dir):
        raise HTTPException(status_code=404, detail="Output files not found on disk")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fname in os.listdir(output_dir):
            fpath = os.path.join(output_dir, fname)
            if os.path.isfile(fpath):
                zf.write(fpath, arcname=fname)

    zip_buffer.seek(0)

    filename = record.get("filename", job_id)
    base_name = os.path.splitext(filename)[0]
    zip_name  = f"{base_name}_analysis.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )