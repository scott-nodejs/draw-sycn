import { CheckCircle2, X } from 'lucide-vue-next';
import MathPreview from './MathPreview.vue';
const __VLS_props = defineProps();
const emit = defineEmits();
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
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-render']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-render']} */ ;
/** @type {__VLS_StyleScopedClasses['math-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "answer-editor" },
});
/** @type {__VLS_StyleScopedClasses['answer-editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
(__VLS_ctx.question.number);
(__VLS_ctx.question.type);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('close'));
            // @ts-ignore
            [question, question, emit,];
        } },
    title: "关闭",
});
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.X} */
X;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.question.answer),
    rows: "5",
    placeholder: "填写正确答案，支持 LaTeX 公式",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "answer-render" },
});
/** @type {__VLS_StyleScopedClasses['answer-render']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_5 = MathPreview;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    text: (__VLS_ctx.question.answer || '尚未填写答案'),
}));
const __VLS_7 = __VLS_6({
    text: (__VLS_ctx.question.answer || '尚未填写答案'),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.question.analysis),
    rows: "12",
    placeholder: "填写完整、准确的解题过程，支持 LaTeX 公式",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "answer-render analysis-render" },
});
/** @type {__VLS_StyleScopedClasses['answer-render']} */ ;
/** @type {__VLS_StyleScopedClasses['analysis-render']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_10 = MathPreview;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    text: (__VLS_ctx.question.analysis || '尚未填写解析'),
}));
const __VLS_12 = __VLS_11({
    text: (__VLS_ctx.question.analysis || '尚未填写解析'),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('save', __VLS_ctx.question));
            // @ts-ignore
            [question, question, question, question, question, emit,];
        } },
    ...{ class: "primary" },
    disabled: (__VLS_ctx.saving),
});
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
CheckCircle2;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
(__VLS_ctx.saving ? '保存中' : '保存答案与解析');
// @ts-ignore
[saving, saving,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
