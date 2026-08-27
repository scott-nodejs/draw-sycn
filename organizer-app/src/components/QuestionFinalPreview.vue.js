import { computed } from 'vue';
import AuthenticatedImage from './AuthenticatedImage.vue';
import MathPreview from './MathPreview.vue';
const props = defineProps();
const blocks = computed(() => props.question.presentationLayout?.blocks || []);
const hasLayout = computed(() => blocks.value.length > 0);
const previewHeight = computed(() => Math.max(220, Math.min(520, props.question.presentationLayout?.height || 360)));
const images = computed(() => props.question.figureUrls || []);
function blockStyle(block) { return { left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${block.height || 15}%` }; }
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['final-block']} */ ;
/** @type {__VLS_StyleScopedClasses['final-block']} */ ;
/** @type {__VLS_StyleScopedClasses['final-images']} */ ;
/** @type {__VLS_StyleScopedClasses['final-options']} */ ;
/** @type {__VLS_StyleScopedClasses['final-options']} */ ;
if (__VLS_ctx.hasLayout) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "final-layout" },
        ...{ style: ({ height: `${__VLS_ctx.previewHeight}px` }) },
    });
    /** @type {__VLS_StyleScopedClasses['final-layout']} */ ;
    for (const [block] of __VLS_vFor((__VLS_ctx.blocks))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (block.id),
            ...{ class: "final-block" },
            'data-kind': (block.kind),
            ...{ style: (__VLS_ctx.blockStyle(block)) },
        });
        /** @type {__VLS_StyleScopedClasses['final-block']} */ ;
        if (block.kind === 'stem') {
            const __VLS_0 = MathPreview;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                text: (__VLS_ctx.question.stem),
            }));
            const __VLS_2 = __VLS_1({
                text: (__VLS_ctx.question.stem),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        }
        else if (block.kind === 'options') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "final-options" },
            });
            /** @type {__VLS_StyleScopedClasses['final-options']} */ ;
            for (const [option, index] of __VLS_vFor((__VLS_ctx.question.options))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (index),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                (String.fromCharCode(65 + index));
                const __VLS_5 = MathPreview;
                // @ts-ignore
                const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                    text: (option),
                }));
                const __VLS_7 = __VLS_6({
                    text: (option),
                }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                // @ts-ignore
                [hasLayout, previewHeight, blocks, blockStyle, question, question,];
            }
        }
        else if (__VLS_ctx.question.figureUrls?.[block.figureIndex || 0]) {
            const __VLS_10 = AuthenticatedImage;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
                path: (__VLS_ctx.question.figureUrls[block.figureIndex || 0]),
                alt: "题目图片",
            }));
            const __VLS_12 = __VLS_11({
                path: (__VLS_ctx.question.figureUrls[block.figureIndex || 0]),
                alt: "题目图片",
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        }
        // @ts-ignore
        [question, question,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "final-default" },
    });
    /** @type {__VLS_StyleScopedClasses['final-default']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "final-stem" },
    });
    /** @type {__VLS_StyleScopedClasses['final-stem']} */ ;
    const __VLS_15 = MathPreview;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        text: (__VLS_ctx.question.stem),
    }));
    const __VLS_17 = __VLS_16({
        text: (__VLS_ctx.question.stem),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    if (__VLS_ctx.images.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "final-images" },
        });
        /** @type {__VLS_StyleScopedClasses['final-images']} */ ;
        for (const [path] of __VLS_vFor((__VLS_ctx.images))) {
            const __VLS_20 = AuthenticatedImage;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
                key: (path),
                path: (path),
                alt: "题目图片",
            }));
            const __VLS_22 = __VLS_21({
                key: (path),
                path: (path),
                alt: "题目图片",
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
            // @ts-ignore
            [question, images, images,];
        }
    }
    if (__VLS_ctx.question.options?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "final-options" },
        });
        /** @type {__VLS_StyleScopedClasses['final-options']} */ ;
        for (const [option, index] of __VLS_vFor((__VLS_ctx.question.options))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (index),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (String.fromCharCode(65 + index));
            const __VLS_25 = MathPreview;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
                text: (option),
            }));
            const __VLS_27 = __VLS_26({
                text: (option),
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            // @ts-ignore
            [question, question,];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
