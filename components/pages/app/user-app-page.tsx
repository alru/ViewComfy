"use client"

/**
 * User-facing app page that always loads view_comfy.json
 * Unlike /playground, this doesn't depend on NEXT_PUBLIC_VIEW_MODE
 */

import {
    Settings,
    Download,
    CircleX
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import PlaygroundForm from "@/components/pages/playground/playground-form";
import { usePostPlayground } from "@/hooks/playground/use-post-playground";
import { ActionType, type IViewComfy, type IViewComfyWorkflow, useViewComfy } from "@/app/providers/view-comfy-provider";
import { ErrorAlertDialog } from "@/components/ui/error-alert-dialog";
import { ResponseError } from "@/app/models/errors";
import BlurFade from "@/components/ui/blur-fade";
import { cn, getComfyUIRandomSeed } from "@/lib/utils";
import { createMediaDragHandler } from "@/lib/drag-utils";
import WorkflowSwitcher from "@/components/workflow-switchter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PreviewOutputsImageGallery } from "@/components/images-preview"
import dynamic from "next/dynamic";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { IUsePostPlayground } from "@/hooks/playground/interfaces";
import { Textarea } from "@/components/ui/textarea";
import * as constants from "@/app/constants";
import { ISetResults, S3FilesData } from "@/app/models/prompt-result";
import { ApiErrorHandler } from "@/lib/api-error-handler";

import {
    TransformWrapper,
    TransformComponent,
} from "react-zoom-pan-pinch";

interface IOutput {
    file: File | S3FilesData,
    url: string
}

interface IGeneration {
    status?: string | undefined;
    outputs: IOutput[],
    errorData?: string | undefined;
}

interface IResults {
    [promptId: string]: IGeneration;
}

const apiErrorHandler = new ApiErrorHandler();

const getOutputFileName = (output: { file: File | S3FilesData, url: string }): string => {
    if ("filename" in output.file) {
        return output.file.filename;
    } else {
        return output.file.name;
    }
}

const getOutputContentType = (output: IOutput): string => {
    if ("contentType" in output.file) {
        return output.file.contentType;
    } else {
        return output.file.type;
    }
}

export default function UserAppPage() {
    const { doPost, loading, setLoading } = usePostPlayground();
    const [results, setResults] = useState<IResults>({});
    const { viewComfyState, viewComfyStateDispatcher } = useViewComfy();
    const [errorAlertDialog, setErrorAlertDialog] = useState<{ open: boolean, errorTitle: string | undefined, errorDescription: React.JSX.Element, onClose: () => void }>({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
    const [textOutputEnabled, setTextOutputEnabled] = useState(false);
    const [showOutputFileName, setShowOutputFileName] = useState(false);
    const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
    const [isRequesting, setIsRequesting] = useState(false);
    const isNotificationAvailable = typeof window !== 'undefined' && 'Notification' in window;

    const requestPermission = useCallback(async () => {
        if (!isNotificationAvailable) return;
        if (permission === 'default' && !isRequesting) {
            setIsRequesting(true);
            try {
                const result = await Notification.requestPermission();
                setPermission(result);
            } catch (error) {
                console.error('Error requesting notification permission:', error);
                setPermission(Notification.permission);
            } finally {
                setIsRequesting(false);
            }
        }
    }, [permission, isRequesting, isNotificationAvailable]);

    const sendNotification = useCallback(async () => {
        if (!isNotificationAvailable) return;
        if (permission === 'granted') {
            new Notification('Generation Complete!', {
                body: 'Your image generation has finished.',
                icon: '/view_comfy_logo.svg',
            });
        } else if (permission === 'default') {
            await requestPermission();
        }
    }, [permission, requestPermission, isNotificationAvailable]);

    // Always fetch workflow on mount (no viewMode check)
    useEffect(() => {
        const fetchViewComfy = async () => {
            try {
                const response = await fetch("/api/playground", {
                    headers: { "accept": "application/json" }
                });
                if (!response.ok) {
                    const text = await response.text();
                    const data = text ? JSON.parse(text) : {};
                    const responseError: ResponseError = data;
                    throw responseError;
                }
                const data = await response.json();
                viewComfyStateDispatcher({ type: ActionType.INIT_VIEW_COMFY, payload: data.viewComfyJSON });
            } catch (error: unknown) {
                const typedError = error as ResponseError & { message?: string };
                if (typedError.errorType) {
                    const responseError = apiErrorHandler.apiErrorToDialog(typedError);
                    setErrorAlertDialog({
                        open: true,
                        errorTitle: responseError.title,
                        errorDescription: <>{responseError.description}</>,
                        onClose: () => { },
                    });
                } else {
                    setErrorAlertDialog({
                        open: true,
                        errorTitle: "Error",
                        errorDescription: <>{typedError.message || "Failed to load workflow"}</>,
                        onClose: () => { },
                    });
                }
            }
        };
        fetchViewComfy();
    }, [viewComfyStateDispatcher]);

    const onSetResults = useCallback(async (params: ISetResults) => {
        const { promptId, status, errorData } = params;
        const outputs = params.outputs || [];
        const resultOutputs: { file: File | S3FilesData, url: string }[] = [];

        for (const output of outputs) {
            let url;
            if (output instanceof File) {
                try {
                    url = URL.createObjectURL(output);
                } catch {
                    console.error("cannot parse output to URL");
                    url = "";
                }
            } else {
                url = output.filepath;
            }
            resultOutputs.push({ file: output, url });
        }

        const newGeneration: IResults = {
            [promptId]: { status, outputs: resultOutputs, errorData }
        };

        setResults((prevResults) => {
            if (prevResults[promptId]) return prevResults;
            return { ...newGeneration, ...prevResults };
        });
        setLoading(false);
        await sendNotification();
    }, [setLoading, sendNotification]);

    function onSubmit(data: IViewComfyWorkflow) {
        const inputs: { key: string, value: unknown }[] = [];

        for (const dataInputs of data.inputs) {
            for (const input of dataInputs.inputs) {
                if (input.visibility === undefined || input.visibility !== "deleted") {
                    inputs.push({ key: input.key, value: input.value });
                }
            }
        }

        for (const advancedInput of data.advancedInputs) {
            for (const input of advancedInput.inputs) {
                if (input.visibility === undefined || input.visibility !== "deleted") {
                    inputs.push({ key: input.key, value: input.value });
                }
            }
        }

        const generationData = {
            inputs: inputs,
            textOutputEnabled: data.textOutputEnabled ?? false
        };

        for (const input of generationData.inputs) {
            if (constants.SEED_LIKE_INPUT_VALUES.some(str => input.key.includes(str)) && input.value === Number.MIN_VALUE) {
                input.value = getComfyUIRandomSeed();
            }
        }

        setTextOutputEnabled(data.textOutputEnabled ?? false);
        setShowOutputFileName(data.showOutputFileName ?? false);

        const doPostParams = {
            viewComfy: generationData,
            workflow: viewComfyState.currentViewComfy?.workflowApiJSON,
            viewcomfyEndpoint: viewComfyState.currentViewComfy?.viewComfyJSON.viewcomfyEndpoint ?? "",
            onSuccess: (params: { promptId: string, outputs: File[] }) => {
                onSetResults({ ...params });
            },
            onError: (error: any) => {
                const errorDialog = apiErrorHandler.apiErrorToDialog(error);
                setErrorAlertDialog({
                    open: true,
                    errorTitle: errorDialog.title,
                    errorDescription: <>{errorDialog.description}</>,
                    onClose: () => {
                        setErrorAlertDialog({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
                    }
                });
            }
        };

        doPost(doPostParams);
    }

    useEffect(() => {
        return () => {
            for (const generation of Object.values(results)) {
                for (const output of generation.outputs) {
                    URL.revokeObjectURL(output.url);
                }
            }
        };
    }, []);

    const onSelectChange = (data: IViewComfy) => {
        return viewComfyStateDispatcher({
            type: ActionType.UPDATE_CURRENT_VIEW_COMFY,
            payload: { ...data }
        });
    };

    const onShowErrorDialog = (error: string) => {
        setErrorAlertDialog({
            open: true,
            errorTitle: "Error",
            errorDescription: <>{error}</>,
            onClose: () => {
                setErrorAlertDialog({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
            }
        });
    };

    // Loading state
    if (!viewComfyState.currentViewComfy) {
        return (
            <div className="flex flex-col h-screen">
                <ErrorAlertDialog
                    open={errorAlertDialog.open}
                    errorTitle={errorAlertDialog.errorTitle}
                    errorDescription={errorAlertDialog.errorDescription}
                    onClose={errorAlertDialog.onClose}
                />
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-var(--top-nav-height))]">
                <div className="md:hidden w-full flex pl-4 gap-x-2">
                    <WorkflowSwitcher
                        viewComfys={viewComfyState.viewComfys}
                        currentViewComfy={viewComfyState.currentViewComfy}
                        onSelectChange={onSelectChange}
                    />
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden self-bottom w-[85px] gap-1">
                                <Settings className="size-4" />
                                Settings
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="max-h-[80vh] gap-4 px-4 h-full">
                            <PlaygroundForm
                                viewComfyJSON={viewComfyState.currentViewComfy.viewComfyJSON}
                                onSubmit={onSubmit}
                                loading={loading}
                            />
                        </DrawerContent>
                    </Drawer>
                </div>
                <main className="flex overflow-hidden flex-1 gap-0">
                    <div className="relative hidden flex-col w-full max-w-[450px] items-start md:flex flex-shrink-0 overflow-hidden rounded-l-xl bg-muted/50 p-4">
                        <div className="flex flex-col w-full h-full min-h-0 min-w-0 bg-background rounded-xl overflow-hidden border shadow-md">
                            {viewComfyState.viewComfys.length > 0 && (
                                <div className="px-2 pt-4 w-full">
                                    <WorkflowSwitcher
                                        viewComfys={viewComfyState.viewComfys}
                                        currentViewComfy={viewComfyState.currentViewComfy}
                                        onSelectChange={onSelectChange}
                                    />
                                </div>
                            )}
                            <PlaygroundForm
                                viewComfyJSON={viewComfyState.currentViewComfy.viewComfyJSON}
                                onSubmit={onSubmit}
                                loading={loading}
                            />
                        </div>
                    </div>
                    <div className="relative flex h-full min-h-[50vh] w-full rounded-r-xl bg-muted/50 lg:col-span-2">
                        <ScrollArea className="relative flex h-full w-full flex-1 flex-col">
                            {(Object.keys(results).length === 0) && !loading && (
                                <>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
                                        <PreviewOutputsImageGallery viewComfyJSON={viewComfyState.currentViewComfy.viewComfyJSON} />
                                    </div>
                                    <Badge variant="outline" className="absolute right-3 top-3">
                                        Output preview
                                    </Badge>
                                </>
                            )}
                            {(Object.keys(results).length > 0) && (
                                <div className="absolute right-3 top-3 flex gap-2">
                                    <Badge variant="outline">Output</Badge>
                                </div>
                            )}
                            <div className="flex-1 h-full p-4 flex overflow-y-auto">
                                <div className="flex flex-col w-full h-full">
                                    <GeneratingIndicator loading={loading} />
                                    {Object.entries(results).map(([promptId, generation], index, array) => (
                                        <div className="flex flex-col gap-4 w-full h-full" key={promptId}>
                                            <div className="flex flex-wrap w-full h-full gap-4 pt-4">
                                                {generation.status === "error" && (
                                                    <GenerationError
                                                        generation={generation}
                                                        onShowErrorDialog={onShowErrorDialog}
                                                        promptId={promptId}
                                                    />
                                                )}
                                                {generation.status !== "error" && generation.outputs.map((output) => (
                                                    <Fragment key={output.url}>
                                                        <OutputRenderer
                                                            output={output}
                                                            showOutputFileName={showOutputFileName}
                                                            textOutputEnabled={textOutputEnabled}
                                                        />
                                                    </Fragment>
                                                ))}
                                            </div>
                                            <hr className={`w-full py-4 ${index !== array.length - 1 ? 'border-gray-300' : 'border-transparent'}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </main>
                <ErrorAlertDialog
                    open={errorAlertDialog.open}
                    errorTitle={errorAlertDialog.errorTitle}
                    errorDescription={errorAlertDialog.errorDescription}
                    onClose={errorAlertDialog.onClose}
                />
            </div>
        </>
    );
}

// Simplified generating indicator
function GeneratingIndicator({ loading }: { loading: boolean }) {
    if (!loading) return null;

    return (
        <>
            <style jsx global>{`
                @keyframes vc-indeterminate {
                    0% { transform: translateX(-120%); }
                    100% { transform: translateX(320%); }
                }
                .vc-indeterminate {
                    animation: vc-indeterminate 1.2s ease-in-out infinite;
                }
            `}</style>
            <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-wrap w-full gap-4 pt-4">
                    <div className="flex flex-col gap-2 sm:w-[calc(50%-2rem)] lg:w-[calc(33.333%-2rem)]">
                        <BlurFade delay={0.25} inView className="flex items-center justify-center w-full h-full">
                            <div className="w-full h-64 rounded-md bg-muted animate-pulse flex items-center justify-center">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted-foreground/20 animate-pulse"></div>
                                    <span className="text-sm text-muted-foreground animate-pulse">Generating...</span>
                                </div>
                            </div>
                        </BlurFade>
                        <div className="flex flex-col gap-2">
                            <div role="progressbar" className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/10">
                                <div className="vc-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-muted-foreground/40" />
                            </div>
                        </div>
                    </div>
                </div>
                <hr className="w-full py-4 border-gray-300" />
            </div>
        </>
    );
}

function GenerationError({ generation, promptId, onShowErrorDialog }: {
    generation: IGeneration,
    promptId: string,
    onShowErrorDialog: (error: string) => void,
}) {
    const getErrorMessage = (gen: IGeneration): string => {
        return gen.errorData || "Something went wrong running your workflow";
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-wrap w-full gap-4 pt-4">
                <div className="flex items-center justify-center sm:w-[calc(50%-2rem)] lg:w-[calc(33.333%-2rem)]">
                    <BlurFade delay={0.25} inView className="flex items-center justify-center w-full h-full">
                        <div className="w-full h-64 rounded-md bg-muted flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <CircleX color="#ff0000" />
                                <span className="text-sm text-muted-foreground">
                                    <Button variant="outline" onClick={() => onShowErrorDialog(getErrorMessage(generation))}>
                                        Show Error
                                    </Button>
                                </span>
                            </div>
                        </div>
                    </BlurFade>
                </div>
            </div>
        </div>
    );
}

function OutputRenderer({ output, textOutputEnabled, showOutputFileName }: {
    output: IOutput,
    textOutputEnabled: boolean,
    showOutputFileName: boolean,
}) {
    const contentType = getOutputContentType(output);

    const getOutputComponent = () => {
        if (contentType.startsWith('image/') && contentType !== "image/vnd.adobe.photoshop") {
            return <ImageDialog output={output} showOutputFileName={showOutputFileName} />;
        } else if (contentType.startsWith('video/')) {
            return <VideoDialog output={output} />;
        } else if (contentType.startsWith('audio/')) {
            return <AudioDialog output={output} />;
        } else if (contentType.startsWith('text/')) {
            return null;
        } else {
            return <FileOutput output={output} />;
        }
    };

    const outputComponent = getOutputComponent();

    return (
        <>
            {outputComponent && (
                <div className="flex pt-1 w-64 h-64 items-center justify-center">
                    <BlurFade delay={0.25} inView className="flex items-center justify-center w-full h-full">
                        {outputComponent}
                    </BlurFade>
                </div>
            )}
            {contentType.startsWith('text/') && textOutputEnabled && (
                <BlurFade delay={0.25} inView className="flex items-center justify-center w-full h-full">
                    <TextOutput output={output} />
                </BlurFade>
            )}
        </>
    );
}

function ImageDialog({ output, showOutputFileName }: { output: IOutput, showOutputFileName: boolean }) {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    const [imageNaturalWidth, setImageNaturalWidth] = useState(0);
    const [imageNaturalHeight, setImageNaturalHeight] = useState(0);

    const imageScale = useMemo(() => {
        if (!containerWidth || !containerHeight || !imageNaturalWidth || !imageNaturalHeight) return 0;
        return Math.min(containerWidth / imageNaturalWidth, containerHeight / imageNaturalHeight);
    }, [containerWidth, containerHeight, imageNaturalWidth, imageNaturalHeight]);

    const handleResize = useCallback(() => {
        if (container) {
            const rect = container.getBoundingClientRect();
            setContainerWidth(rect.width);
            setContainerHeight(rect.height);
        }
    }, [container]);

    useEffect(() => {
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [handleResize]);

    useEffect(() => {
        const image = new Image();
        image.onload = () => {
            setImageNaturalWidth(image.naturalWidth);
            setImageNaturalHeight(image.naturalHeight);
        };
        image.src = output.url;
    }, [output]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <img
                    src={output.url}
                    alt="Generated output"
                    className="w-full h-64 object-contain rounded-md transition-all hover:scale-105 hover:cursor-pointer"
                    draggable="true"
                    onDragStart={createMediaDragHandler({
                        url: output.url,
                        filename: getOutputFileName(output),
                        contentType: getOutputContentType(output)
                    })}
                />
            </DialogTrigger>
            {showOutputFileName && <span className="text-xs text-muted-foreground">{getOutputFileName(output)}</span>}
            <DialogContent className="max-w-fit max-h-[90vh] border-0 p-0 bg-transparent [&>button]:bg-background [&>button]:border [&>button]:border-border [&>button]:rounded-full [&>button]:p-1 [&>button]:shadow-md">
                <div
                    className="rounded-md"
                    style={{ width: "100%", height: "100%", cursor: "zoom-in" }}
                    ref={setContainer}
                >
                    <TransformWrapper
                        key={`${containerWidth}x${containerHeight}`}
                        initialScale={imageScale}
                        minScale={imageScale}
                        maxScale={imageScale * 8}
                        centerOnInit
                    >
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%", borderRadius: "8px" }}>
                            <img src={output.url} alt="Generated output" className="max-h-[85vh] w-auto object-contain rounded-md" />
                        </TransformComponent>
                    </TransformWrapper>
                </div>
                <DialogFooter className="bg-transparent">
                    <Button className="w-full" onClick={() => {
                        const link = document.createElement('a');
                        link.href = output.url;
                        link.download = output.url.split('/').pop() || 'download';
                        link.click();
                    }}>
                        Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function VideoDialog({ output }: { output: IOutput }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div
                    draggable="true"
                    onDragStart={createMediaDragHandler({
                        url: output.url,
                        filename: getOutputFileName(output),
                        contentType: getOutputContentType(output)
                    })}
                    className="w-full"
                >
                    <video className="w-full h-64 object-cover rounded-md hover:cursor-pointer" controls>
                        <source src={output.url} />
                    </video>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-fit max-h-[90vh] border-0 p-0 bg-transparent [&>button]:bg-background [&>button]:border [&>button]:border-border [&>button]:rounded-full [&>button]:p-1 [&>button]:shadow-md">
                <video className="max-h-[85vh] w-auto object-contain rounded-md" controls>
                    <source src={output.url} />
                </video>
            </DialogContent>
        </Dialog>
    );
}

function AudioDialog({ output }: { output: IOutput }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div
                    draggable="true"
                    onDragStart={createMediaDragHandler({
                        url: output.url,
                        filename: getOutputFileName(output),
                        contentType: getOutputContentType(output)
                    })}
                >
                    <audio src={output.url} controls />
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-fit max-h-[90vh] border-0 p-0 bg-transparent [&>button]:bg-background [&>button]:border [&>button]:border-border [&>button]:rounded-full [&>button]:p-1 [&>button]:shadow-md">
                <audio src={output.url} controls />
            </DialogContent>
        </Dialog>
    );
}

function TextOutput({ output }: { output: IOutput }) {
    const [text, setText] = useState("");

    useEffect(() => {
        if (output.file instanceof File) {
            output.file.text().then(setText);
        } else {
            fetch(`/api/text-proxy?url=${encodeURIComponent(output.url)}`)
                .then(res => res.ok ? res.text() : "")
                .then(setText)
                .catch(() => setText(""));
        }
    }, [output]);

    return (
        <div className="pt-4 w-full">
            <Textarea value={text} readOnly className="w-full" rows={5} />
        </div>
    );
}

function FileOutput({ output }: { output: IOutput }) {
    const outputName = getOutputFileName(output);

    return (
        <div className="flex w-full items-center justify-center">
            <Button onClick={() => {
                const link = document.createElement('a');
                link.href = output.url;
                link.download = outputName;
                link.click();
            }}>
                <Download className="h-4 w-4 mr-2" />
                {outputName}
            </Button>
        </div>
    );
}
