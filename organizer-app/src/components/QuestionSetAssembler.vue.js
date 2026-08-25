import { computed, ref } from 'vue';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Search, Trash2 } from 'lucide-vue-next';
import MathPreview from './MathPreview.vue';
const props = defineProps();
const emit = defineEmits();
const form = ref(JSON.parse(JSON.stringify(props.initial))), query = ref(''), typeFilter = ref('全部题型'), paperFilter = ref('全部试卷');
const types = computed(() => ['全部题型', ...new Set(props.questions.map(q => q.type).filter(Boolean))]);
const papers = computed(() => ['全部试卷', ...new Set(props.questions.map(q => q.sourceTitle || q.paperId))]);
const paperStats = computed(() => papers.value.map(name => ({ name, count: name === '全部试卷' ? props.questions.length : props.questions.filter(q => (q.sourceTitle || q.paperId) === name).length })));
const available = computed(() => props.questions.filter(q => (paperFilter.value === '全部试卷' || (q.sourceTitle || q.paperId) === paperFilter.value) && (typeFilter.value === '全部题型' || q.type === typeFilter.value) && (!query.value || `${q.number} ${q.stem}`.toLowerCase().includes(query.value.toLowerCase()))));
const selected = computed(() => form.value.questionIds.map(id => props.questions.find(q => q.id === id)).filter(Boolean));
function toggle(id) { const i = form.value.questionIds.indexOf(id); i < 0 ? form.value.questionIds.push(id) : form.value.questionIds.splice(i, 1); }
function move(i, d) { const j = i + d; if (j < 0 || j >= form.value.questionIds.length)
    return; [form.value.questionIds[i], form.value.questionIds[j]] = [form.value.questionIds[j], form.value.questionIds[i]]; }
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
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['save']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-config']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-config']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-config']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['picked']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
/** @type {__VLS_StyleScopedClasses['source-title']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['source-title']} */ ;
/** @type {__VLS_StyleScopedClasses['source-title']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['library']} */ ;
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['set-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['set-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['set-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['set-structure']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['katex']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['assembly-stem']} */ ;
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "assembly-page" },
});
/** @type {__VLS_StyleScopedClasses['assembly-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('close'));
            // @ts-ignore
            [emit,];
        } },
});
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.ArrowLeft} */
ArrowLeft;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.editing ? '编辑试题集' : '组装试题集');
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.emit('save', __VLS_ctx.form));
            // @ts-ignore
            [emit, editing, form,];
        } },
    ...{ class: "save" },
    disabled: (__VLS_ctx.saving || !__VLS_ctx.form.title.trim() || !__VLS_ctx.selected.length),
});
/** @type {__VLS_StyleScopedClasses['save']} */ ;
(__VLS_ctx.saving ? '保存中…' : `保存试题集（${__VLS_ctx.selected.length}题）`);
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "assembly-config" },
});
/** @type {__VLS_StyleScopedClasses['assembly-config']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.form.collectionType),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "topic",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "paper",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "question_type",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "mixed",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "例如：几何专题、函数专题、选择题专项",
});
(__VLS_ctx.form.topicLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "用于商店展示的标题",
});
(__VLS_ctx.form.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(__VLS_ctx.form.subject);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(__VLS_ctx.form.grade);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    step: "0.01",
});
(__VLS_ctx.form.price);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "desc" },
});
/** @type {__VLS_StyleScopedClasses['desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "适用对象、难度、内容特色",
});
(__VLS_ctx.form.description);
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "source-papers" },
});
/** @type {__VLS_StyleScopedClasses['source-papers']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "source-title" },
});
/** @type {__VLS_StyleScopedClasses['source-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "paper-sources" },
});
/** @type {__VLS_StyleScopedClasses['paper-sources']} */ ;
for (const [paper] of __VLS_vFor((__VLS_ctx.paperStats))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.paperFilter = paper.name);
                // @ts-ignore
                [form, form, form, form, form, form, form, form, saving, saving, selected, selected, paperStats, paperFilter,];
            } },
        key: (paper.name),
        ...{ class: ({ active: __VLS_ctx.paperFilter === paper.name }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (paper.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (paper.count);
    __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
    (paper.count);
    // @ts-ignore
    [paperFilter,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "library" },
});
/** @type {__VLS_StyleScopedClasses['library']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pane-head" },
});
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(__VLS_ctx.paperFilter === '全部试卷' ? '全部已校正题目' : __VLS_ctx.paperFilter);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.available.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filters" },
});
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.Search} */
Search;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "搜索题干或题号",
});
(__VLS_ctx.query);
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.typeFilter),
});
for (const [type] of __VLS_vFor((__VLS_ctx.types))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (type),
    });
    (type);
    // @ts-ignore
    [paperFilter, paperFilter, available, query, typeFilter, types,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "question-list" },
});
/** @type {__VLS_StyleScopedClasses['question-list']} */ ;
for (const [q] of __VLS_vFor((__VLS_ctx.available))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.toggle(q.id));
                // @ts-ignore
                [available, toggle,];
            } },
        key: (q.id),
        ...{ class: ({ picked: __VLS_ctx.form.questionIds.includes(q.id) }) },
    });
    /** @type {__VLS_StyleScopedClasses['picked']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
    if (__VLS_ctx.form.questionIds.includes(q.id)) {
        let __VLS_10;
        /** @ts-ignore @type { | typeof __VLS_components.Check} */
        Check;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
        const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (q.number);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (q.type);
    if (q.figureUrls?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
    }
    const __VLS_15 = MathPreview;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        ...{ class: "assembly-stem" },
        text: (q.stem),
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "assembly-stem" },
        text: (q.stem),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    /** @type {__VLS_StyleScopedClasses['assembly-stem']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "source-line" },
    });
    /** @type {__VLS_StyleScopedClasses['source-line']} */ ;
    (q.sourceTitle || '来源试卷');
    (q.sourceGrade || __VLS_ctx.form.grade);
    __VLS_asFunctionalElement1(__VLS_intrinsics.mark, __VLS_intrinsics.mark)({});
    (__VLS_ctx.form.questionIds.includes(q.id) ? '已选' : '选择');
    // @ts-ignore
    [form, form, form, form,];
}
if (!__VLS_ctx.available.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty" },
    });
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "set-structure" },
});
/** @type {__VLS_StyleScopedClasses['set-structure']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pane-head" },
});
/** @type {__VLS_StyleScopedClasses['pane-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.form.topicLabel || '尚未填写专题名称');
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_ctx.selected.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "set-summary" },
});
/** @type {__VLS_StyleScopedClasses['set-summary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.form.title || '未命名试题集');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.form.collectionType === 'topic' ? '知识专题' : __VLS_ctx.form.collectionType === 'paper' ? '完整试卷' : __VLS_ctx.form.collectionType === 'question_type' ? '题型专题' : '混合精选');
(__VLS_ctx.form.subject);
(__VLS_ctx.form.grade);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "selected-list" },
});
/** @type {__VLS_StyleScopedClasses['selected-list']} */ ;
for (const [q, i] of __VLS_vFor((__VLS_ctx.selected))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        key: (q.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (i + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (q.type);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (q.sourceTitle || q.paperId);
    const __VLS_20 = MathPreview;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        ...{ class: "selected-stem" },
        text: (q.stem),
    }));
    const __VLS_22 = __VLS_21({
        ...{ class: "selected-stem" },
        text: (q.stem),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    /** @type {__VLS_StyleScopedClasses['selected-stem']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.move(i, -1));
                // @ts-ignore
                [form, form, form, form, form, form, form, selected, selected, available, move,];
            } },
        disabled: (i === 0),
    });
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.ArrowUp} */
    ArrowUp;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({}));
    const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.move(i, 1));
                // @ts-ignore
                [move,];
            } },
        disabled: (i === __VLS_ctx.selected.length - 1),
    });
    let __VLS_30;
    /** @ts-ignore @type { | typeof __VLS_components.ArrowDown} */
    ArrowDown;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({}));
    const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.toggle(q.id));
                // @ts-ignore
                [selected, toggle,];
            } },
        ...{ class: "remove" },
    });
    /** @type {__VLS_StyleScopedClasses['remove']} */ ;
    let __VLS_35;
    /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
    Trash2;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({}));
    const __VLS_37 = __VLS_36({}, ...__VLS_functionalComponentArgsRest(__VLS_36));
    // @ts-ignore
    [];
}
if (!__VLS_ctx.selected.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty" },
    });
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
// @ts-ignore
[selected,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
