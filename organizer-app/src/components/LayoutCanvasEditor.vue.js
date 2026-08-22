import { computed, ref } from 'vue';
import { CheckCircle2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-vue-next';
import AuthenticatedImage from './AuthenticatedImage.vue';
import MathPreview from './MathPreview.vue';
const props = defineProps();
const emit = defineEmits();
const zoom = ref(0.85);
function defaults() { const blocks = [{ id: 'stem', kind: 'stem', x: 4, y: 4, width: 92, height: 18 }, { id: 'options', kind: 'options', x: 4, y: 24, width: 92, height: 14 }]; (props.question.figureUrls || []).forEach((_, index) => blocks.push({ id: `figure-${index}`, kind: 'figure', figureIndex: index, x: 5 + (index % 3) * 31, y: 42 + Math.floor(index / 3) * 34, width: 28, height: 30 })); return { width: 100, height: 620, blocks }; }
const layout = ref(props.question.presentationLayout?.blocks?.length ? JSON.parse(JSON.stringify(props.question.presentationLayout)) : defaults());
const blocks = computed(() => layout.value.blocks || []);
let active = null;
function begin(event, block, mode) { event.preventDefault(); event.stopPropagation(); const canvas = event.currentTarget.closest('.free-layout-canvas'); if (!canvas)
    return; active = { id: block.id, mode, x: event.clientX, y: event.clientY, start: { ...block }, bounds: canvas.getBoundingClientRect() }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); }
function move(event) { if (!active)
    return; const dx = (event.clientX - active.x) / active.bounds.width * 100, dy = (event.clientY - active.y) / active.bounds.height * 100; layout.value = { ...layout.value, blocks: blocks.value.map(block => { if (block.id !== active.id)
        return block; const start = active.start; if (active.mode === 'move')
        return { ...block, x: clamp(start.x + dx, 0, 100 - start.width), y: clamp(start.y + dy, 0, 100 - (start.height || 10)) }; return { ...block, width: clamp(start.width + dx, 8, 100 - start.x), height: clamp((start.height || 15) + dy, 6, 100 - start.y) }; }) }; }
function end() { active = null; window.removeEventListener('pointermove', move); }
function remove(id) { layout.value = { ...layout.value, blocks: blocks.value.filter(block => block.id !== id) }; }
function reset() { layout.value = defaults(); zoom.value = .85; }
function clamp(value, min, max) { return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10; }
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['canvas-zoom']} */ ;
/** @type {__VLS_StyleScopedClasses['canvas-zoom']} */ ;
/** @type {__VLS_StyleScopedClasses['close-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['canvas-zoom']} */ ;
/** @type {__VLS_StyleScopedClasses['close-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['free-layout-block']} */ ;
/** @type {__VLS_StyleScopedClasses['free-layout-block']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-block']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-block']} */ ;
/** @type {__VLS_StyleScopedClasses['block-content']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "layout-editor-layer" },
});
/** @type {__VLS_StyleScopedClasses['layout-editor-layer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "layout-editor-dialog" },
});
/** @type {__VLS_StyleScopedClasses['layout-editor-dialog']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "canvas-zoom" },
});
/** @type {__VLS_StyleScopedClasses['canvas-zoom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.zoom = Math.max(.5, __VLS_ctx.zoom - .1));
            // @ts-ignore
            [zoom, zoom,];
        } },
});
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Minus} */
Minus;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(Math.round(__VLS_ctx.zoom * 100));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.zoom = Math.min(1.5, __VLS_ctx.zoom + .1));
            // @ts-ignore
            [zoom, zoom, zoom,];
        } },
});
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.Plus} */
Plus;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.zoom = 1);
            // @ts-ignore
            [zoom,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('close'));
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "close-editor" },
});
/** @type {__VLS_StyleScopedClasses['close-editor']} */ ;
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.X} */
X;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "canvas-scroll" },
});
/** @type {__VLS_StyleScopedClasses['canvas-scroll']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "canvas-zoom-wrapper" },
    ...{ style: ({ width: `${1000 * __VLS_ctx.zoom}px`, height: `${(__VLS_ctx.layout.height || 620) * __VLS_ctx.zoom}px` }) },
});
/** @type {__VLS_StyleScopedClasses['canvas-zoom-wrapper']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "free-layout-canvas" },
    ...{ style: ({ width: '1000px', height: `${__VLS_ctx.layout.height || 620}px`, transform: `scale(${__VLS_ctx.zoom})` }) },
});
/** @type {__VLS_StyleScopedClasses['free-layout-canvas']} */ ;
for (const [block] of __VLS_vFor((__VLS_ctx.blocks))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onPointerdown: (...[$event]) => {
                return (__VLS_ctx.begin($event, block, 'move'));
                // @ts-ignore
                [zoom, zoom, zoom, layout, layout, blocks, begin,];
            } },
        key: (block.id),
        ...{ class: "free-layout-block" },
        'data-kind': (block.kind),
        ...{ style: ({ left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${block.height || 15}%` }) },
    });
    /** @type {__VLS_StyleScopedClasses['free-layout-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "block-label" },
    });
    /** @type {__VLS_StyleScopedClasses['block-label']} */ ;
    (block.kind === 'stem' ? '题干' : block.kind === 'options' ? '选项' : `图片 ${(block.figureIndex || 0) + 1}`);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onPointerdown: () => { } },
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.remove(block.id));
                // @ts-ignore
                [remove,];
            } },
        ...{ class: "delete-block" },
        title: "删除",
    });
    /** @type {__VLS_StyleScopedClasses['delete-block']} */ ;
    let __VLS_15;
    /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
    Trash2;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({}));
    const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "block-content" },
    });
    /** @type {__VLS_StyleScopedClasses['block-content']} */ ;
    if (block.kind === 'stem') {
        const __VLS_20 = MathPreview;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            text: (__VLS_ctx.question.stem),
        }));
        const __VLS_22 = __VLS_21({
            text: (__VLS_ctx.question.stem),
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    else if (block.kind === 'options') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "canvas-options" },
        });
        /** @type {__VLS_StyleScopedClasses['canvas-options']} */ ;
        for (const [option, index] of __VLS_vFor((__VLS_ctx.question.options))) {
            const __VLS_25 = MathPreview;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
                key: (index),
                text: (`${String.fromCharCode(65 + index)}. ${option}`),
            }));
            const __VLS_27 = __VLS_26({
                key: (index),
                text: (`${String.fromCharCode(65 + index)}. ${option}`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            // @ts-ignore
            [question, question,];
        }
    }
    else if (__VLS_ctx.question.figureUrls?.[block.figureIndex || 0]) {
        const __VLS_30 = AuthenticatedImage;
        // @ts-ignore
        const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
            path: (__VLS_ctx.question.figureUrls[block.figureIndex || 0]),
        }));
        const __VLS_32 = __VLS_31({
            path: (__VLS_ctx.question.figureUrls[block.figureIndex || 0]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
        ...{ onPointerdown: (...[$event]) => {
                return (__VLS_ctx.begin($event, block, 'resize'));
                // @ts-ignore
                [begin, question, question,];
            } },
        ...{ class: "block-resizer" },
    });
    /** @type {__VLS_StyleScopedClasses['block-resizer']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.reset) },
    ...{ class: "ghost" },
});
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
let __VLS_35;
/** @ts-ignore @type { | typeof __VLS_components.RotateCcw} */
RotateCcw;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({}));
const __VLS_37 = __VLS_36({}, ...__VLS_functionalComponentArgsRest(__VLS_36));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('close'));
            // @ts-ignore
            [emit, reset,];
        } },
    ...{ class: "ghost" },
});
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('save', __VLS_ctx.layout));
            // @ts-ignore
            [emit, layout,];
        } },
    ...{ class: "primary" },
    disabled: (__VLS_ctx.saving),
});
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
let __VLS_40;
/** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
CheckCircle2;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({}));
const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
(__VLS_ctx.saving ? '保存中' : '保存版式');
// @ts-ignore
[saving, saving,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
