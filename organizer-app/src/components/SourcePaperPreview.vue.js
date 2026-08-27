import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { LoaderCircle, Move, ScanLine } from 'lucide-vue-next';
import { api } from '../api';
const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const props = defineProps();
const emit = defineEmits();
const viewport = ref(null), pageUrls = ref([]), loadingPages = ref(new Set()), renderedPages = ref(new Set()), pageErrors = ref(new Set()), loadError = ref('');
let drag = null;
let loadGeneration = 0;
function release() { loadGeneration++; pageUrls.value.forEach(url => url?.startsWith('blob:') && URL.revokeObjectURL(url)); pageUrls.value = []; loadingPages.value = new Set(); renderedPages.value = new Set(); pageErrors.value = new Set(); }
async function loadPage(page, generation) {
    if (pageUrls.value[page - 1] || loadingPages.value.has(page))
        return;
    const loading = new Set(loadingPages.value);
    loading.add(page);
    loadingPages.value = loading;
    try {
        const location = await api.pageLocation(props.paper.id, page);
        const url = location.url || URL.createObjectURL(await api.pageBlob(props.paper.id, page));
        if (generation !== loadGeneration) {
            if (url.startsWith('blob:'))
                URL.revokeObjectURL(url);
            return;
        }
        const urls = [...pageUrls.value];
        urls[page - 1] = url;
        pageUrls.value = urls;
        const errors = new Set(pageErrors.value);
        errors.delete(page);
        pageErrors.value = errors;
        loadError.value = '';
    }
    catch (error) {
        if (generation !== loadGeneration)
            return;
        const errors = new Set(pageErrors.value);
        errors.add(page);
        pageErrors.value = errors;
        if (pageUrls.value.every(url => !url))
            loadError.value = error instanceof Error ? error.message : '原卷加载失败';
    }
    finally {
        if (generation === loadGeneration) {
            const next = new Set(loadingPages.value);
            next.delete(page);
            loadingPages.value = next;
        }
    }
}
function pageRendered(page) { const rendered = new Set(renderedPages.value); rendered.add(page); renderedPages.value = rendered; if (regionsForPage(page).length)
    nextTick().then(() => window.setTimeout(scrollToQuestion, 40)); }
async function loadPaper() {
    release();
    loadError.value = '';
    const generation = loadGeneration;
    const count = Math.max(1, props.paper.pageCount);
    pageUrls.value = Array(count).fill(null);
    const questionPages = [...new Set((props.question.sourceRegions || []).map(region => region.pageNumber))].filter(page => page >= 1 && page <= count);
    const remaining = Array.from({ length: count }, (_, index) => index + 1).filter(page => !questionPages.includes(page));
    await Promise.all(questionPages.map(page => loadPage(page, generation)));
    if (generation !== loadGeneration)
        return;
    for (let index = 0; index < remaining.length; index += 2)
        await Promise.all(remaining.slice(index, index + 2).map(page => loadPage(page, generation)));
}
function regionsForPage(page) { return (props.question.sourceRegions || []).map((region, index) => ({ region, index })).filter(item => item.region.pageNumber === page); }
function scrollToQuestion() { const container = viewport.value, target = container?.querySelector('.paper-question-region'); if (!container || !target)
    return; container.scrollTo({ top: Math.max(0, target.offsetTop + target.parentElement.offsetTop - container.clientHeight * .25), behavior: 'smooth' }); }
function startAdjust(event, index, mode) { const page = event.currentTarget.closest('.paper-source-page'), region = props.question.sourceRegions?.[index]; if (!page || !region)
    return; event.preventDefault(); event.stopPropagation(); const box = page.getBoundingClientRect(); drag = { index, mode, x: event.clientX, y: event.clientY, region: { ...region }, box, grabX: (event.clientX - box.left) / box.width * 1000 - region.x0, grabY: (event.clientY - box.top) / box.height * 1000 - region.y0 }; window.addEventListener('pointermove', adjust); window.addEventListener('pointerup', stopAdjust, { once: true }); }
function pageAtPoint(x, y) { for (const element of document.elementsFromPoint(x, y)) {
    const page = element.closest?.('.paper-source-page');
    if (page)
        return page;
} return null; }
function adjust(event) { if (!drag)
    return; const next = { ...drag.region }; if (drag.mode === 'move') {
    const target = pageAtPoint(event.clientX, event.clientY);
    if (!target)
        return;
    const box = target.getBoundingClientRect(), width = next.x1 - next.x0, height = next.y1 - next.y0;
    next.pageNumber = Number(target.dataset.page) || next.pageNumber;
    next.x0 = clamp((event.clientX - box.left) / box.width * 1000 - drag.grabX, 0, 1000 - width);
    next.y0 = clamp((event.clientY - box.top) / box.height * 1000 - drag.grabY, 0, 1000 - height);
    next.x1 = next.x0 + width;
    next.y1 = next.y0 + height;
}
else {
    const dx = (event.clientX - drag.x) / drag.box.width * 1000, dy = (event.clientY - drag.y) / drag.box.height * 1000;
    if (drag.mode.includes('w'))
        next.x0 = clamp(drag.region.x0 + dx, 0, next.x1 - 10);
    if (drag.mode.includes('e'))
        next.x1 = clamp(drag.region.x1 + dx, next.x0 + 10, 1000);
    if (drag.mode.includes('n'))
        next.y0 = clamp(drag.region.y0 + dy, 0, next.y1 - 10);
    if (drag.mode.includes('s'))
        next.y1 = clamp(drag.region.y1 + dy, next.y0 + 10, 1000);
} const all = (props.question.sourceRegions || []).map(item => ({ ...item })); all[drag.index] = next; emit('update:regions', all); }
function stopAdjust() { drag = null; window.removeEventListener('pointermove', adjust); }
function clamp(value, min, max) { return Math.round(Math.max(min, Math.min(max, value))); }
watch(() => props.paper.id, loadPaper, { immediate: true });
watch(() => props.question.id, () => { const pages = [...new Set((props.question.sourceRegions || []).map(region => region.pageNumber))]; pages.forEach(page => loadPage(page, loadGeneration)); nextTick().then(scrollToQuestion); });
onBeforeUnmount(() => { release(); stopAdjust(); });
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
/** @type {__VLS_StyleScopedClasses['crop-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['crop-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['crop-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-page']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-state']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-source-page']} */ ;
/** @type {__VLS_StyleScopedClasses['page-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['page-loading']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "viewport",
    ...{ class: "paper-source-preview" },
});
/** @type {__VLS_StyleScopedClasses['paper-source-preview']} */ ;
if (__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "paper-source-state error-state" },
    });
    /** @type {__VLS_StyleScopedClasses['paper-source-state']} */ ;
    /** @type {__VLS_StyleScopedClasses['error-state']} */ ;
    (__VLS_ctx.loadError);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "paper-pages" },
    });
    /** @type {__VLS_StyleScopedClasses['paper-pages']} */ ;
    for (const [url, pageIndex] of __VLS_vFor((__VLS_ctx.pageUrls))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (pageIndex),
            ...{ class: "paper-source-page" },
            ...{ class: ({ 'page-pending': !__VLS_ctx.renderedPages.has(pageIndex + 1) }) },
            'data-page': (pageIndex + 1),
        });
        /** @type {__VLS_StyleScopedClasses['paper-source-page']} */ ;
        /** @type {__VLS_StyleScopedClasses['page-pending']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "page-number" },
        });
        /** @type {__VLS_StyleScopedClasses['page-number']} */ ;
        (pageIndex + 1);
        if (url) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ onLoad: (...[$event]) => {
                        if (!!(__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)))
                            throw 0;
                        if (!(url))
                            throw 0;
                        return (__VLS_ctx.pageRendered(pageIndex + 1));
                        // @ts-ignore
                        [loadError, loadError, pageUrls, pageUrls, renderedPages, pageRendered,];
                    } },
                src: (url),
                alt: (`${__VLS_ctx.paper.title} 第 ${pageIndex + 1} 页`),
                loading: (__VLS_ctx.regionsForPage(pageIndex + 1).length ? 'eager' : 'lazy'),
                draggable: "false",
            });
        }
        if (!__VLS_ctx.renderedPages.has(pageIndex + 1)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "page-loading" },
            });
            /** @type {__VLS_StyleScopedClasses['page-loading']} */ ;
            if (!__VLS_ctx.pageErrors.has(pageIndex + 1)) {
                let __VLS_0;
                /** @ts-ignore @type { | typeof __VLS_components.LoaderCircle} */
                LoaderCircle;
                // @ts-ignore
                const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                    ...{ class: "spin" },
                }));
                const __VLS_2 = __VLS_1({
                    ...{ class: "spin" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_1));
                /** @type {__VLS_StyleScopedClasses['spin']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.pageErrors.has(pageIndex + 1) ? '本页加载失败' : '正在加载本页');
            if (__VLS_ctx.pageErrors.has(pageIndex + 1)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)))
                                throw 0;
                            if (!(!__VLS_ctx.renderedPages.has(pageIndex + 1)))
                                throw 0;
                            if (!(__VLS_ctx.pageErrors.has(pageIndex + 1)))
                                throw 0;
                            return (__VLS_ctx.loadPage(pageIndex + 1, __VLS_ctx.loadGeneration));
                            // @ts-ignore
                            [renderedPages, paper, regionsForPage, pageErrors, pageErrors, pageErrors, loadPage, loadGeneration,];
                        } },
                });
            }
        }
        for (const [item] of __VLS_vFor((__VLS_ctx.renderedPages.has(pageIndex + 1) ? __VLS_ctx.regionsForPage(pageIndex + 1) : []))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onPointerdown: (...[$event]) => {
                        if (!!(__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)))
                            throw 0;
                        return (__VLS_ctx.startAdjust($event, item.index, 'move'));
                        // @ts-ignore
                        [renderedPages, regionsForPage, startAdjust,];
                    } },
                key: (item.index),
                ...{ class: "paper-question-region" },
                ...{ style: ({ left: `${item.region.x0 / 10}%`, top: `${item.region.y0 / 10}%`, width: `${(item.region.x1 - item.region.x0) / 10}%`, height: `${(item.region.y1 - item.region.y0) / 10}%` }) },
            });
            /** @type {__VLS_StyleScopedClasses['paper-question-region']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onPointerdown: () => { } },
                ...{ class: "region-float-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['region-float-actions']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.question.number);
            __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
            let __VLS_5;
            /** @ts-ignore @type { | typeof __VLS_components.Move} */
            Move;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
            const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)))
                            throw 0;
                        return (__VLS_ctx.emit('recognize'));
                        // @ts-ignore
                        [question, emit,];
                    } },
                disabled: (__VLS_ctx.recognizing),
            });
            let __VLS_10;
            /** @ts-ignore @type { | typeof __VLS_components.ScanLine} */
            ScanLine;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
            const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
            (__VLS_ctx.recognizing ? '识别中' : '重新识别');
            for (const [handle] of __VLS_vFor((__VLS_ctx.handles))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                    ...{ onPointerdown: (...[$event]) => {
                            if (!!(__VLS_ctx.loadError && __VLS_ctx.pageUrls.every(url => !url)))
                                throw 0;
                            return (__VLS_ctx.startAdjust($event, item.index, handle));
                            // @ts-ignore
                            [startAdjust, recognizing, recognizing, handles,];
                        } },
                    key: (handle),
                    ...{ class: "resize-handle" },
                    'data-handle': (handle),
                });
                /** @type {__VLS_StyleScopedClasses['resize-handle']} */ ;
                // @ts-ignore
                [];
            }
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
