
/* storioke-teller-types (adapted from V1 plan)
   Teller-first Story JSON contract for Storioke.
*/

export type ID = string;

export type SchemaId = "storioke.teller.story.v1";

export interface StoryBundle {
    schema: SchemaId;
    story: StoryMeta;
    navigation: Navigation;
    assetsIndex: AssetsIndex;
    scenes: Record<ID, Scene>; // key = sceneId
    hubs: Record<ID, Hub>; // NEW: explicit hubs keyed by hubId
}

export interface StoryMeta {
    id: ID;
    collectionId: ID;
    title: string;
    subtitle?: string;
    summary?: string;
    version: string;
    language?: string;

    defaults: {
        templateId?: ID;
        highlightTemplateId?: ID;
        scriptureTemplateId?: ID;
        /** Default canvas scene ID to use for image-sequence stages (maps to scene-registry). */
        imageSequenceSceneId?: ID;
        /** Default canvas scene ID to use for audio stages. */
        audioSceneId?: ID;
        /** Default canvas scene ID to use for video stages. */
        videoSceneId?: ID;
        /** Default canvas scene ID to use for overlay stages. */
        overlaySceneId?: ID;
        /** Default ambient audio asset ID for the entire story. */
        ambientAudioId?: ID;
    };
}

export interface Navigation {
    spine: ID[];       // ordered story scene ids
    hubOrder: ID[];    // ordered hub ids for UI tabs/rail
}

/** A hub is a grouped container + optional "hub scene" content */
export interface Hub {
    id: ID;                 // stable hub id (use hub-scene id from DB)
    type: HubType;          // INTRODUCTION, CONTEXT, INSIGHTS...
    title: string;          // UI label
    hubSceneId?: ID;        // optional: the hub-scene that supplies intro blocks
    sceneIds: ID[];         // grouped story scenes (order within hub)
}

export type HubType =
    | "INTRODUCTION"
    | "CONTEXT"
    | "INSIGHTS"
    | "SCRIPTURE"
    | "REFLECTION";

export interface AssetsIndex {
    images?: Record<ID, ImageAsset>;
    audio?: Record<ID, AudioAsset>;
    video?: Record<ID, VideoAsset>;
    templates?: Record<ID, TemplateAsset>;
    canvasScenes?: Record<ID, CanvasSceneAsset>;
}

export interface ImageAsset {
    uri: string; // relative to story bundle root or absolute
    tags?: string[];
    width?: number;
    height?: number;
}

export interface AudioAsset {
    uri: string;
    kind: "SFX" | "VO" | "MUSIC" | "AMB";
    tags?: string[];
    durationSec?: number;
}

export interface VideoAsset {
    uri: string;
    preview?: string[];      // ordered image URIs shown in StagePreview when this clip is selected
    tags?: string[];
    durationSec?: number;
}

export interface TemplateAsset {
    uri: string;
    preview?: string[];      // ordered image URIs shown in StagePreview when this template is selected
    kind?: 'BASE' | 'OVERLAY' | 'HIGHLIGHT' | 'SCRIPTURE';
    tags?: string[];
    /** Scene engine — required for scene:transitionLoad (defaults to 'hype' if absent) */
    engine?: 'hype' | 'pixi' | 'p5' | 'three' | 'svelte';
    /** Renderer surface — required for scene:transitionLoad (defaults to 'iframe' if absent) */
    surface?: 'iframe' | 'canvas' | 'dom';
    /** POC registry sceneId — used as sceneId in scene:transitionLoad payload */
    sceneId?: string;
}

/**
 * A live canvas scene asset backed by a Pixi or Three.js IScene implementation.
 * The `sceneId` maps to a factory in the client-side scene-registry.
 */
export interface CanvasSceneAsset {
    id: ID;
    engine: 'pixi' | 'three';
    /** Registry key — matched in scene-registry.ts to resolve the IScene factory. */
    sceneId: string;
    label: string;
    durationSec?: number;
    tags?: string[];
    /** Video source URL — required when sceneId is 'pixi-video'. */
    videoUrl?: string;
    /** Audio source URL — required when sceneId is 'pixi-audio'. */
    audioUrl?: string;
    /** Cover art / background image URL used by audio (and other) scenes. */
    imageUrl?: string;
}


/* ---------------- Scenes ---------------- */

export interface Scene {
    id: ID;
    sceneKind: "story" | "hub";  // matches DB scene_kind
    hubId?: ID;                  // REQUIRED for story scenes in grouped-hub mode
    title: string;

    card?: SceneCard;
    content: SceneContent;
    stage?: Stage;

    highlights?: Highlight[];
    actions?: Action[];
}

export interface SceneCard {
    summary?: string;
    tags?: string[];
    estSeconds?: number;
    mood?: string;
}

export interface SceneContent {
    bodyBlocks: BodyBlock[];
}

export type BodyBlock =
    | { kind: "markdown"; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
    | { kind: "quote"; text: string; attribution?: string }
    | { kind: "scripture"; ref: ScriptureRef; text: string; translit?: string; meaning?: string }
    | { kind: "divider" };

export interface ScriptureRef {
    source: "BG" | "SB" | "CC" | "OTHER";
    id: string; // e.g. "2.20" or "1.2.17"
    label?: string; // "Bhagavad-gītā 2.20"
}

/* ---------------- Stage / Prefetch ---------------- */

export interface Stage {
    baseTemplateId?: ID; // if absent, story.defaults.templateId
    prefetch?: Prefetch;
}

export interface Prefetch {
    images?: ID[];
    audio?: ID[];
    video?: ID[];
    templates?: ID[];
    /** Canvas scene asset IDs (pixi/three) to mount in StagePreview */
    canvasScenes?: ID[];
}

/* ---------------- Highlights ---------------- */

export interface Highlight {
    id: ID;

    // Mapping to content for UI selection / scroll-to
    range?: TextRange;

    // fallback plain text for overlay
    text: string;

    overlay?: OverlaySpec;

    actions?: Action[]; // usually sendOverlayToRenderer, playAudio, etc.
}

export interface TextRange {
    blockIndex: number;
    start: number; // char start
    end: number; // char end
}

export interface OverlaySpec {
    templateId?: ID; // if absent, story.defaults.highlightTemplateId
    payload?: Record<string, unknown>; // template-specific data
}

/* ---------------- Actions (Teller verbs) ---------------- */

export type Action =
    | GoToSceneAction
    | OpenLayerAction
    | SendSceneToRendererAction
    | SendOverlayToRendererAction
    | PlayAudioAction
    | StopAudioAction
    | SetTemplateAction;

export interface BaseAction {
    id?: ID;
    label?: string;
}

export interface GoToSceneAction extends BaseAction {
    type: "goToScene";
    targetSceneId: ID;
}

export interface OpenLayerAction extends BaseAction {
    type: "openLayer";
    targetLayerId: ID;
}

export interface SendSceneToRendererAction extends BaseAction {
    type: "sendSceneToRenderer";
    sceneId?: ID; // default current
    mode?: "replace" | "push"; // replace current renderer scene or push into stack
}

export interface SendOverlayToRendererAction extends BaseAction {
    type: "sendOverlayToRenderer";
    highlightId?: ID; // default selected highlight
    mode?: "replace" | "push";
}

export interface PlayAudioAction extends BaseAction {
    type: "playAudio";
    audioId: ID;
    channel?: "SFX" | "VO" | "MUSIC" | "AMB";
    loop?: boolean;
}

export interface StopAudioAction extends BaseAction {
    type: "stopAudio";
    audioId?: ID; // stop specific
    channel?: "SFX" | "VO" | "MUSIC" | "AMB"; // or stop channel
    all?: boolean; // emergency stop
}

export interface SetTemplateAction extends BaseAction {
    type: "setTemplate";
    templateId: ID;
    scope: "sceneBase" | "overlay";
}
