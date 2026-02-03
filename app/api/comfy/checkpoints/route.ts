import { type NextRequest, NextResponse } from 'next/server';
import { ErrorResponseFactory } from '@/app/models/errors';

const errorResponseFactory = new ErrorResponseFactory();

export async function GET(request: NextRequest) {
    const comfyUrl = process.env.COMFYUI_API_URL || "127.0.0.1:8188";
    const secure = process.env.COMFYUI_SECURE === "true";
    const protocol = secure ? "https://" : "http://";

    try {
        const response = await fetch(`${protocol}${comfyUrl}/object_info/CheckpointLoaderSimple`);

        if (!response.ok) {
            throw new Error(`ComfyUI returned ${response.status}`);
        }

        const data = await response.json();
        const checkpoints = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];

        return NextResponse.json({ checkpoints });

    } catch (error: unknown) {
        console.error("Failed to fetch checkpoints from ComfyUI:", error);

        const responseError = errorResponseFactory.getErrorResponse(error);
        return NextResponse.json(responseError, { status: 500 });
    }
}
