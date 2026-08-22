import { onBeforeUnmount, ref, watch } from 'vue';
import { api } from '../api';
const props = defineProps();
const url = ref(''), failed = ref(false);
function clear() { if (url.value)
    URL.revokeObjectURL(url.value); url.value = ''; }
async function load() { clear(); failed.value = false; try {
    url.value = URL.createObjectURL(await api.assetBlob(props.path));
}
catch {
    failed.value = true;
} }
watch(() => props.path, load, { immediate: true });
onBeforeUnmount(clear);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.url) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (__VLS_ctx.url),
        alt: (__VLS_ctx.alt || '题目图片'),
    });
}
else if (__VLS_ctx.failed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "secure-image-error" },
    });
    /** @type {__VLS_StyleScopedClasses['secure-image-error']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "secure-image-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['secure-image-loading']} */ ;
}
// @ts-ignore
[url, url, alt, failed,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
