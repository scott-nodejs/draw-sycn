import { computed } from 'vue';
import katex from 'katex';
const props = defineProps();
function escape(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function normalizeLatex(value) { return value.replace(/\f(?=rac\b)/g, '\\f').replace(/\r(?=ight\b)/g, '\\r').replace(/\t(?=(?:imes|heta|ext)\b)/g, '\\t').replace(/(^|[^\\A-Za-z])(sqrt|frac|dfrac|tfrac)\s*\{/g, '$1\\$2{'); }
const html = computed(() => { const source = props.text || ''; let output = '', last = 0; const expression = /\$([^$]+)\$/g; let match; while ((match = expression.exec(source))) {
    output += escape(source.slice(last, match.index));
    try {
        output += katex.renderToString(normalizeLatex(match[1].trim()), { throwOnError: false, strict: false });
    }
    catch {
        output += escape(match[0]);
    }
    last = match.index + match[0].length;
} return (output + escape(source.slice(last))).replace(/\n/g, '<br/>'); });
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "math-preview" },
});
__VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.html), }, null, null);
/** @type {__VLS_StyleScopedClasses['math-preview']} */ ;
// @ts-ignore
[html,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
