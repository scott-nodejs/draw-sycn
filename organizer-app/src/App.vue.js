import { computed, onMounted, ref, watch } from 'vue';
import { AlertTriangle, Archive, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, FileStack, LayoutDashboard, LogOut, Plus, RefreshCw, Search, Settings2, ShoppingBag, Tags, Trash2, UploadCloud, WandSparkles } from 'lucide-vue-next';
import { api, session } from './api';
import SourcePaperPreview from './components/SourcePaperPreview.vue';
import MathPreview from './components/MathPreview.vue';
import AuthenticatedImage from './components/AuthenticatedImage.vue';
import LayoutCanvasEditor from './components/LayoutCanvasEditor.vue';
import QuestionSetAssembler from './components/QuestionSetAssembler.vue';
const current = ref(session.get()), page = ref('dashboard'), papers = ref([]), questions = ref([]), confirmedQuestions = ref([]), sets = ref([]), selectedPaper = ref(null), selectedQuestion = ref(null), busy = ref(false), error = ref(''), toast = ref('');
const processingDetail = ref(null);
const regionEditing = ref(false);
const recognizing = ref(false);
const layoutOpen = ref(false);
const authMode = ref('login'), auth = ref({ name: '', account: '', password: '' });
const showAuth = ref(false);
const uploadOpen = ref(false), files = ref([]), upload = ref({ title: '', subject: '数学', grade: '初三' });
const setOpen = ref(false), setForm = ref({ title: '', description: '', subject: '数学', grade: '初三', collectionType: 'topic', topicLabel: '', price: 19.9, questionIds: [] });
const setTab = ref('mine'), editingSetId = ref(null);
const knowledgePoints = ref([]), selectedKnowledgePoint = ref(''), questionSearch = ref(''), questionType = ref(''), questionDifficulty = ref(''), editingKnowledgeQuestion = ref(null), newKnowledgeName = ref('');
const expandedKnowledge = ref(new Set());
const pageSize = 10, paperPageSize = 9, paperPage = ref(1), taskPage = ref(1), questionPage = ref(1), paperSearch = ref(''), paperFilter = ref('all'), taskFilter = ref('all');
const reviewPaperCount = computed(() => papers.value.filter(p => p.status === 'review').length);
const filteredPapers = computed(() => papers.value.filter(p => (paperFilter.value === 'all' || p.status === 'review') && (!paperSearch.value || `${p.title} ${p.grade} ${p.subject}`.toLowerCase().includes(paperSearch.value.toLowerCase()))));
const taskCounts = computed(() => ({ running: papers.value.filter(p => p.status === 'processing' || p.status === 'queued').length, failed: papers.value.filter(p => p.status === 'failed').length, completed: papers.value.filter(p => !['processing', 'queued', 'failed'].includes(p.status)).length }));
const filteredTasks = computed(() => papers.value.filter(p => taskFilter.value === 'all' || (taskFilter.value === 'running' && (p.status === 'processing' || p.status === 'queued')) || (taskFilter.value === 'failed' && p.status === 'failed') || (taskFilter.value === 'completed' && !['processing', 'queued', 'failed'].includes(p.status))));
const filteredQuestions = computed(() => confirmedQuestions.value.filter(q => (!selectedKnowledgePoint.value || q.knowledgePointIds?.includes(selectedKnowledgePoint.value)) && (!questionSearch.value || `${q.stem} ${q.sourceTitle || ''}`.toLowerCase().includes(questionSearch.value.toLowerCase())) && (!questionType.value || q.type === questionType.value) && (!questionDifficulty.value || q.difficulty === questionDifficulty.value)));
const pageCount = (total, size = pageSize) => Math.max(1, Math.ceil(total / size));
const pageItems = (items, currentPage, size = pageSize) => items.slice((currentPage - 1) * size, currentPage * size);
const paperPageCount = computed(() => pageCount(filteredPapers.value.length, paperPageSize)), taskPageCount = computed(() => pageCount(filteredTasks.value.length)), questionPageCount = computed(() => pageCount(filteredQuestions.value.length));
const pagedPapers = computed(() => pageItems(filteredPapers.value, paperPage.value, paperPageSize)), pagedTasks = computed(() => pageItems(filteredTasks.value, taskPage.value)), pagedQuestions = computed(() => pageItems(filteredQuestions.value, questionPage.value));
const visiblePages = (currentPage, totalPages) => Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4)) + index);
const rootKnowledgePoints = computed(() => knowledgePoints.value.filter(item => !item.parentId));
const knowledgeChildren = (parentId) => knowledgePoints.value.filter(item => item.parentId === parentId);
function toggleKnowledge(id) { const next = new Set(expandedKnowledge.value); next.has(id) ? next.delete(id) : next.add(id); expandedKnowledge.value = next; }
const questionImages = (question) => question.figureUrls?.length ? question.figureUrls : (question.cropUrls?.slice(0, 1) || []);
const knowledgeName = (id) => knowledgePoints.value.find(item => item.id === id)?.name || '';
const stats = computed(() => ({ total: papers.value.length, parsing: papers.value.filter(p => ['queued', 'processing'].includes(p.status)).length, reviewing: papers.value.filter(p => p.status === 'review').length, done: papers.value.reduce((n, p) => n + p.reviewedCount, 0), published: sets.value.filter(s => s.status === 'published').length }));
function notify(v) { toast.value = v; setTimeout(() => toast.value = '', 2400); }
function warningLabel(value) { return { question_start_not_found: '未定位到题号，当前使用整页区域', last_question_boundary_uses_document_end: '末题区域延伸到试卷内容结尾', cross_page_question_merged: '已自动合并跨页内容', source_region_verified_from_layout_v3: '题目区域已通过版面检测校验' }[value] || value; }
async function run(task) { busy.value = true; error.value = ''; try {
    await task();
}
catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败';
}
finally {
    busy.value = false;
} }
async function authenticate() { await run(async () => { const result = authMode.value === 'login' ? await api.login(auth.value.account, auth.value.password) : await api.register(auth.value.name, auth.value.account, auth.value.password); if (result.user.role !== 'organizer')
    throw new Error('该账号不是试题整理人员账号'); session.set(result); current.value = result; await load(); }); }
async function load() { await Promise.all([api.papers().then(v => papers.value = v), api.sets().then(v => sets.value = v), api.confirmedQuestions().then(v => confirmedQuestions.value = v), api.knowledgePoints().then(v => knowledgePoints.value = v)]); }
async function toggleQuestionKnowledge(q, pointId) { const ids = new Set(q.knowledgePointIds || []); ids.has(pointId) ? ids.delete(pointId) : ids.add(pointId); await run(async () => { const result = await api.assignKnowledgePoints(q.id, [...ids]); q.knowledgePointIds = result.knowledgePointIds; knowledgePoints.value = await api.knowledgePoints(); notify('知识点已更新'); }); }
async function createKnowledgePoint() { const name = newKnowledgeName.value.trim(); if (!name)
    return; await run(async () => { const parent = knowledgePoints.value.find(item => item.id === selectedKnowledgePoint.value); await api.createKnowledgePoint({ name, subject: parent?.subject || confirmedQuestions.value[0]?.sourceSubject || '数学', grade: parent?.grade || confirmedQuestions.value[0]?.sourceGrade || '', parentId: parent?.id }); newKnowledgeName.value = ''; knowledgePoints.value = await api.knowledgePoints(); notify('知识点已创建'); }); }
async function openPaper(p) { selectedPaper.value = p; page.value = 'review'; processingDetail.value = null; regionEditing.value = false; if (p.status === 'processing') {
    questions.value = [];
    processingDetail.value = await api.processing(p.id);
    return;
} await run(async () => { questions.value = await api.questions(p.id); selectedQuestion.value = questions.value[0] || null; }); }
async function refreshPaper() { if (!selectedPaper.value)
    return; await run(async () => { const status = await api.processing(selectedPaper.value.id); processingDetail.value = status; notify(`解析进度 ${status.progress}% · ${status.stage}`); await load(); const fresh = papers.value.find(p => p.id === selectedPaper.value.id); if (fresh) {
    selectedPaper.value = fresh;
    if (fresh.status !== 'processing')
        await openPaper(fresh);
} }); }
async function reparsePaper() {
    if (!selectedPaper.value || busy.value)
        return;
    if (!window.confirm('重新解析会重新执行整份试卷的版面检测、OCR 和切题，并更新当前识别结果。确定继续吗？'))
        return;
    await run(async () => {
        processingDetail.value = await api.retry(selectedPaper.value.id);
        selectedPaper.value = { ...selectedPaper.value, status: 'processing', progress: 0 };
        questions.value = [];
        selectedQuestion.value = null;
        regionEditing.value = false;
        notify('已提交重新解析，请稍后刷新进度');
        await load();
        const fresh = papers.value.find(item => item.id === selectedPaper.value.id);
        if (fresh)
            selectedPaper.value = fresh;
    });
}
async function retryTask(p) { await run(async () => { await api.retry(p.id); await load(); notify('已重新启动试卷解析任务'); }); }
async function deletePaper(p) { if (!window.confirm(`确定删除“${p.title}”吗？该试卷及其所属试题将从工作台中移除。`))
    return; await run(async () => { await api.deletePaper(p.id); await load(); notify('试卷及所属试题已删除'); }); }
async function submitUpload() { if (!files.value.length)
    return error.value = '请选择 PDF、图片或 ZIP'; await run(async () => { const result = await api.upload(files.value, upload.value); const uploaded = Array.isArray(result) ? result : [result]; uploadOpen.value = false; files.value = []; await load(); notify(uploaded.length > 1 ? `已创建 ${uploaded.length} 个解析任务` : '上传成功，AI 已开始解析'); await openPaper(uploaded[0]); }); }
async function saveQuestion() { if (!selectedQuestion.value)
    return; await run(async () => { selectedQuestion.value = await api.saveQuestion({ ...selectedQuestion.value, status: 'confirmed' }); const i = questions.value.findIndex(q => q.id === selectedQuestion.value.id); questions.value[i] = selectedQuestion.value; notify('校对结果已保存'); await load(); }); }
async function saveLayout(layout) { if (!selectedQuestion.value)
    return; selectedQuestion.value = { ...selectedQuestion.value, presentationLayout: layout }; await saveQuestion(); layoutOpen.value = false; }
function updateRegions(regions) { if (selectedQuestion.value)
    selectedQuestion.value = { ...selectedQuestion.value, sourceRegions: regions }; }
async function toggleRegionEditing() { if (!regionEditing.value) {
    regionEditing.value = true;
    return;
} if (!selectedQuestion.value)
    return; await run(async () => { selectedQuestion.value = await api.saveQuestion(selectedQuestion.value); const index = questions.value.findIndex(item => item.id === selectedQuestion.value.id); if (index >= 0)
    questions.value[index] = selectedQuestion.value; regionEditing.value = false; notify('切题区域已保存并生成新版本'); }); }
function setFigurePosition(value) { if (selectedQuestion.value)
    selectedQuestion.value = { ...selectedQuestion.value, presentationLayout: { ...selectedQuestion.value.presentationLayout, figurePosition: value } }; }
async function reprocessSelected() { if (!selectedQuestion.value?.sourceRegions?.length || recognizing.value)
    return; recognizing.value = true; error.value = ''; try {
    const currentId = selectedQuestion.value.id;
    const queued = await api.reprocessQuestion(currentId, selectedQuestion.value.sourceRegions);
    for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const state = await api.reprocessStatus(currentId, queued.reprocessJobId);
        if (state.status === 'failed')
            throw new Error(state.errorMessage || '重新识别失败');
        if (state.status === 'done') {
            questions.value = await api.questions(selectedPaper.value.id);
            selectedQuestion.value = questions.value.find(item => item.id === currentId) || null;
            regionEditing.value = false;
            notify('已按调整后的红框重新识别');
            return;
        }
    }
    throw new Error('重新识别等待超时，请稍后刷新');
}
catch (e) {
    error.value = e instanceof Error ? e.message : '重新识别失败';
}
finally {
    recognizing.value = false;
} }
function openSetEditor(item) { editingSetId.value = item?.id || null; setForm.value = item ? { title: item.title, description: item.description || '', subject: item.subject, grade: item.grade, collectionType: item.collectionType || 'topic', topicLabel: item.topicLabel || '', price: item.price, questionIds: [...(item.questionIds || [])] } : { title: '', description: '', subject: '数学', grade: '初三', collectionType: 'topic', topicLabel: '', price: 19.9, questionIds: [] }; setOpen.value = true; page.value = 'assembly'; }
function openTeacherStore() { window.open(import.meta.env.VITE_TEACHER_APP_URL || 'http://127.0.0.1:5173/?page=question-sets&tab=store', '_blank', 'noopener,noreferrer'); }
async function createSet() { await run(async () => { editingSetId.value ? await api.updateSet(editingSetId.value, setForm.value) : await api.createSet(setForm.value); setOpen.value = false; editingSetId.value = null; await load(); page.value = 'sets'; notify('试题集已保存'); }); }
function closeSetEditor() { setOpen.value = false; editingSetId.value = null; page.value = 'sets'; }
async function saveSetForm(value) { setForm.value = value; await createSet(); }
async function publish(s) { await run(async () => { await api.publishSet(s.id); await load(); notify('试题集已发布到老师端商店'); }); }
async function unpublish(s) { if (!window.confirm('下线后老师端商店将不再展示该试题集，已有购买记录不受影响。确定下线吗？'))
    return; await run(async () => { await api.unpublishSet(s.id); await load(); notify('试题集已下线，现在可以编辑'); }); }
async function deleteSet(s) { if (!window.confirm(`确定删除试题集“${s.title}”吗？删除后将不再显示。`))
    return; await run(async () => { await api.deleteSet(s.id); await load(); notify('试题集已删除'); }); }
function logout() { session.set(null); current.value = null; }
onMounted(() => { if (current.value)
    load().catch(e => error.value = e.message); });
watch(page, (next, previous) => { if (next !== previous && next !== 'review')
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
watch([paperSearch, paperFilter], () => paperPage.value = 1);
watch(taskFilter, () => taskPage.value = 1);
watch([selectedKnowledgePoint, questionSearch, questionType, questionDifficulty], () => questionPage.value = 1);
watch(paperPageCount, total => paperPage.value = Math.min(paperPage.value, total));
watch(taskPageCount, total => taskPage.value = Math.min(taskPage.value, total));
watch(questionPageCount, total => questionPage.value = Math.min(questionPage.value, total));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (!__VLS_ctx.current && !__VLS_ctx.showAuth) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "public-site" },
    });
    /** @type {__VLS_StyleScopedClasses['public-site']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "public-header" },
    });
    /** @type {__VLS_StyleScopedClasses['public-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "public-brand" },
    });
    /** @type {__VLS_StyleScopedClasses['public-brand']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "brand-mark" },
    });
    /** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [current, showAuth, showAuth,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [showAuth,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [showAuth,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                __VLS_ctx.authMode = 'login';
                __VLS_ctx.showAuth = true;
                // @ts-ignore
                [showAuth, authMode,];
            } },
        ...{ class: "ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                __VLS_ctx.authMode = 'register';
                __VLS_ctx.showAuth = true;
                // @ts-ignore
                [showAuth, authMode,];
            } },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "public-main" },
    });
    /** @type {__VLS_StyleScopedClasses['public-main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "public-hero" },
    });
    /** @type {__VLS_StyleScopedClasses['public-hero']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                __VLS_ctx.authMode = 'login';
                __VLS_ctx.showAuth = true;
                // @ts-ignore
                [showAuth, authMode,];
            } },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.Plus} */
    Plus;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                __VLS_ctx.authMode = 'login';
                __VLS_ctx.showAuth = true;
                // @ts-ignore
                [showAuth, authMode,];
            } },
        ...{ class: "ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
    ChevronRight;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "public-visual" },
    });
    /** @type {__VLS_StyleScopedClasses['public-visual']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "paper-sheet" },
    });
    /** @type {__VLS_StyleScopedClasses['paper-sheet']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
    WandSparkles;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
    const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "public-capabilities" },
    });
    /** @type {__VLS_StyleScopedClasses['public-capabilities']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "assembly-heading" },
    });
    /** @type {__VLS_StyleScopedClasses['assembly-heading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "assembly-options" },
    });
    /** @type {__VLS_StyleScopedClasses['assembly-options']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [showAuth,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "assembly-symbol" },
    });
    /** @type {__VLS_StyleScopedClasses['assembly-symbol']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [showAuth,];
            } },
        ...{ class: "assembly-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['assembly-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    let __VLS_15;
    /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
    WandSparkles;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({}));
    const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
    ChevronRight;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                return (__VLS_ctx.showAuth = true);
                // @ts-ignore
                [showAuth,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "assembly-symbol" },
    });
    /** @type {__VLS_StyleScopedClasses['assembly-symbol']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (!__VLS_ctx.current) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-shell" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-shell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-copy" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-copy']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "brand-mark" },
    });
    /** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-feature" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-feature']} */ ;
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
    WandSparkles;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({}));
    const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.authenticate) },
        ...{ class: "auth-card" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.showAuth = false);
                // @ts-ignore
                [current, showAuth, authenticate,];
            } },
        type: "button",
        ...{ class: "auth-back" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-back']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "eyebrow" },
    });
    /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.authMode === 'login' ? '登录整理工作台' : '创建整理人员账号');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    if (__VLS_ctx.authMode === 'register') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            required: true,
            placeholder: "请输入真实姓名",
        });
        (__VLS_ctx.auth.name);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        required: true,
        placeholder: "11 位手机号",
    });
    (__VLS_ctx.auth.account);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        required: true,
        type: "password",
        placeholder: "至少 8 位",
    });
    (__VLS_ctx.auth.password);
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error" },
        });
        /** @type {__VLS_StyleScopedClasses['error']} */ ;
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ class: "primary wide" },
        disabled: (__VLS_ctx.busy),
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['wide']} */ ;
    (__VLS_ctx.busy ? '请稍候…' : __VLS_ctx.authMode === 'login' ? '登录' : '注册并进入');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.authMode = __VLS_ctx.authMode === 'login' ? 'register' : 'login');
                // @ts-ignore
                [authMode, authMode, authMode, authMode, authMode, auth, auth, auth, error, error, busy, busy,];
            } },
        type: "button",
        ...{ class: "link" },
    });
    /** @type {__VLS_StyleScopedClasses['link']} */ ;
    (__VLS_ctx.authMode === 'login' ? '还没有账号？申请入驻' : '已有账号？返回登录');
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shell" },
        ...{ class: ({ 'review-workspace': __VLS_ctx.page === 'review' }) },
    });
    /** @type {__VLS_StyleScopedClasses['shell']} */ ;
    /** @type {__VLS_StyleScopedClasses['review-workspace']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "sidebar" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "logo-row" },
    });
    /** @type {__VLS_StyleScopedClasses['logo-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "brand-mark" },
    });
    /** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.page = 'dashboard');
                // @ts-ignore
                [authMode, page, page,];
            } },
        ...{ class: ({ active: __VLS_ctx.page === 'dashboard' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    let __VLS_30;
    /** @ts-ignore @type { | typeof __VLS_components.LayoutDashboard} */
    LayoutDashboard;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({}));
    const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.page = 'tasks');
                // @ts-ignore
                [page, page,];
            } },
        ...{ class: ({ active: __VLS_ctx.page === 'tasks' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    let __VLS_35;
    /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
    RefreshCw;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({}));
    const __VLS_37 = __VLS_36({}, ...__VLS_functionalComponentArgsRest(__VLS_36));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.stats.parsing);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.page = 'papers');
                // @ts-ignore
                [page, page, stats,];
            } },
        ...{ class: ({ active: __VLS_ctx.page === 'papers' || __VLS_ctx.page === 'review' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    let __VLS_40;
    /** @ts-ignore @type { | typeof __VLS_components.FileStack} */
    FileStack;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.page = 'questions');
                // @ts-ignore
                [page, page, page,];
            } },
        ...{ class: ({ active: __VLS_ctx.page === 'questions' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    let __VLS_45;
    /** @ts-ignore @type { | typeof __VLS_components.Tags} */
    Tags;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({}));
    const __VLS_47 = __VLS_46({}, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.confirmedQuestions.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.page = 'sets');
                // @ts-ignore
                [page, page, confirmedQuestions,];
            } },
        ...{ class: ({ active: __VLS_ctx.page === 'sets' }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    let __VLS_50;
    /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
    BookOpenCheck;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({}));
    const __VLS_52 = __VLS_51({}, ...__VLS_functionalComponentArgsRest(__VLS_51));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "quality-card" },
    });
    /** @type {__VLS_StyleScopedClasses['quality-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    let __VLS_55;
    /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
    CheckCircle2;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({}));
    const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (__VLS_ctx.stats.done);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        ...{ class: "account" },
    });
    /** @type {__VLS_StyleScopedClasses['account']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['avatar']} */ ;
    (__VLS_ctx.current.user.displayName.slice(0, 1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (__VLS_ctx.current.user.displayName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    let __VLS_60;
    /** @ts-ignore @type { | typeof __VLS_components.LogOut} */
    LogOut;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({}));
    const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "main" },
    });
    /** @type {__VLS_StyleScopedClasses['main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "eyebrow" },
    });
    /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.page === 'dashboard' ? '工作概览' : __VLS_ctx.page === 'tasks' ? '新建任务' : __VLS_ctx.page === 'papers' ? '试卷工作台' : __VLS_ctx.page === 'review' ? '拆题校对' : __VLS_ctx.page === 'questions' ? '试题列表' : '试题集发行');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "header-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
    if (__VLS_ctx.page !== 'questions') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
        let __VLS_65;
        /** @ts-ignore @type { | typeof __VLS_components.Search} */
        Search;
        // @ts-ignore
        const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({}));
        const __VLS_67 = __VLS_66({}, ...__VLS_functionalComponentArgsRest(__VLS_66));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                return (__VLS_ctx.uploadOpen = true);
                // @ts-ignore
                [current, current, page, page, page, page, page, page, page, stats, logout, uploadOpen,];
            } },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    let __VLS_70;
    /** @ts-ignore @type { | typeof __VLS_components.UploadCloud} */
    UploadCloud;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({}));
    const __VLS_72 = __VLS_71({}, ...__VLS_functionalComponentArgsRest(__VLS_71));
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error global" },
        });
        /** @type {__VLS_StyleScopedClasses['error']} */ ;
        /** @type {__VLS_StyleScopedClasses['global']} */ ;
        (__VLS_ctx.error);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.error))
                        throw 0;
                    return (__VLS_ctx.error = '');
                    // @ts-ignore
                    [error, error, error,];
                } },
        });
    }
    if (__VLS_ctx.page === 'dashboard') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "content" },
        });
        /** @type {__VLS_StyleScopedClasses['content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hero" },
        });
        /** @type {__VLS_StyleScopedClasses['hero']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    return (__VLS_ctx.uploadOpen = true);
                    // @ts-ignore
                    [page, uploadOpen,];
                } },
            ...{ class: "primary" },
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        let __VLS_75;
        /** @ts-ignore @type { | typeof __VLS_components.Plus} */
        Plus;
        // @ts-ignore
        const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({}));
        const __VLS_77 = __VLS_76({}, ...__VLS_functionalComponentArgsRest(__VLS_76));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hero-visual" },
        });
        /** @type {__VLS_StyleScopedClasses['hero-visual']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "paper-sheet" },
        });
        /** @type {__VLS_StyleScopedClasses['paper-sheet']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        let __VLS_80;
        /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
        WandSparkles;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({}));
        const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stat-grid" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.stats.total);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.stats.parsing);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.stats.reviewing);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.stats.done);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.stats.published);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "quick-assembly" },
        });
        /** @type {__VLS_StyleScopedClasses['quick-assembly']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "assembly-heading" },
        });
        /** @type {__VLS_StyleScopedClasses['assembly-heading']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    return (__VLS_ctx.page = 'sets');
                    // @ts-ignore
                    [page, stats, stats, stats, stats, stats,];
                } },
            ...{ class: "ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
        let __VLS_85;
        /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
        ChevronRight;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({}));
        const __VLS_87 = __VLS_86({}, ...__VLS_functionalComponentArgsRest(__VLS_86));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "assembly-options" },
        });
        /** @type {__VLS_StyleScopedClasses['assembly-options']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "assembly-symbol" },
        });
        /** @type {__VLS_StyleScopedClasses['assembly-symbol']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    return (__VLS_ctx.openSetEditor());
                    // @ts-ignore
                    [openSetEditor,];
                } },
            ...{ class: "assembly-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['assembly-primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        let __VLS_90;
        /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
        WandSparkles;
        // @ts-ignore
        const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({}));
        const __VLS_92 = __VLS_91({}, ...__VLS_functionalComponentArgsRest(__VLS_91));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        let __VLS_95;
        /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
        ChevronRight;
        // @ts-ignore
        const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({}));
        const __VLS_97 = __VLS_96({}, ...__VLS_functionalComponentArgsRest(__VLS_96));
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "assembly-symbol" },
        });
        /** @type {__VLS_StyleScopedClasses['assembly-symbol']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else if (__VLS_ctx.page === 'tasks') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "content task-center" },
        });
        /** @type {__VLS_StyleScopedClasses['content']} */ ;
        /** @type {__VLS_StyleScopedClasses['task-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-center-head" },
        });
        /** @type {__VLS_StyleScopedClasses['task-center-head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "running-dot" },
        });
        /** @type {__VLS_StyleScopedClasses['running-dot']} */ ;
        (__VLS_ctx.taskCounts.running);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-filters" },
        });
        /** @type {__VLS_StyleScopedClasses['task-filters']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    return (__VLS_ctx.taskFilter = 'all');
                    // @ts-ignore
                    [page, taskCounts, taskFilter,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'all' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.papers.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    return (__VLS_ctx.taskFilter = 'running');
                    // @ts-ignore
                    [taskFilter, taskFilter, papers,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'running' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.taskCounts.running);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    return (__VLS_ctx.taskFilter = 'failed');
                    // @ts-ignore
                    [taskCounts, taskFilter, taskFilter,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'failed' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.taskCounts.failed);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    return (__VLS_ctx.taskFilter = 'completed');
                    // @ts-ignore
                    [taskCounts, taskFilter, taskFilter,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'completed' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.taskCounts.completed);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "html-task-list" },
        });
        /** @type {__VLS_StyleScopedClasses['html-task-list']} */ ;
        for (const [p] of __VLS_vFor((__VLS_ctx.pagedTasks))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (p.id),
                ...{ class: "html-task" },
            });
            /** @type {__VLS_StyleScopedClasses['html-task']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "task-badge" },
                'data-status': (p.status),
            });
            /** @type {__VLS_StyleScopedClasses['task-badge']} */ ;
            (p.status === 'processing' ? '试卷解析' : p.status === 'failed' ? '解析失败' : '内容整理');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-main" },
            });
            /** @type {__VLS_StyleScopedClasses['task-main']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (p.status === 'processing' ? '解析试卷：' : p.status === 'failed' ? '解析失败：' : '整理完成：');
            (p.title);
            if (p.status === 'processing') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (p.progress);
            }
            else if (p.status === 'failed') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (p.errorMessage || '解析任务执行失败，请重新开始');
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (p.questionCount);
                (p.reviewedCount);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-progress" },
            });
            /** @type {__VLS_StyleScopedClasses['task-progress']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                ...{ style: ({ width: p.progress + '%' }) },
                'data-status': (p.status),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-end" },
            });
            /** @type {__VLS_StyleScopedClasses['task-end']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            (p.status === 'processing' ? '处理中' : p.status === 'failed' ? '失败' : '已完成');
            (p.progress);
            if (p.status === 'failed') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!(p.status === 'failed'))
                                throw 0;
                            return (__VLS_ctx.retryTask(p));
                            // @ts-ignore
                            [taskCounts, taskFilter, pagedTasks, retryTask,];
                        } },
                    ...{ class: "primary" },
                    disabled: (__VLS_ctx.busy),
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!!(p.status === 'failed'))
                                throw 0;
                            return (__VLS_ctx.openPaper(p));
                            // @ts-ignore
                            [busy, openPaper,];
                        } },
                    ...{ class: "ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
                (p.status === 'processing' ? '查看进度' : '打开结果');
            }
            // @ts-ignore
            [];
        }
        if (!__VLS_ctx.filteredTasks.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['task-empty']} */ ;
            let __VLS_100;
            /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
            RefreshCw;
            // @ts-ignore
            const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({}));
            const __VLS_102 = __VLS_101({}, ...__VLS_functionalComponentArgsRest(__VLS_101));
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.papers.length ? '当前筛选条件下没有任务。' : '上传试卷后，解析任务会显示在这里。');
            if (!__VLS_ctx.papers.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!(!__VLS_ctx.filteredTasks.length))
                                throw 0;
                            if (!(!__VLS_ctx.papers.length))
                                throw 0;
                            return (__VLS_ctx.uploadOpen = true);
                            // @ts-ignore
                            [uploadOpen, papers, papers, filteredTasks,];
                        } },
                    ...{ class: "primary" },
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                let __VLS_105;
                /** @ts-ignore @type { | typeof __VLS_components.Plus} */
                Plus;
                // @ts-ignore
                const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({}));
                const __VLS_107 = __VLS_106({}, ...__VLS_functionalComponentArgsRest(__VLS_106));
            }
        }
        if (__VLS_ctx.filteredTasks.length > __VLS_ctx.pageSize) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
                ...{ class: "pagination" },
                'aria-label': "任务列表分页",
            });
            /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.filteredTasks.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.taskPage--);
                        // @ts-ignore
                        [filteredTasks, pageSize, taskPage,];
                    } },
                disabled: (__VLS_ctx.taskPage === 1),
                title: "上一页",
            });
            let __VLS_110;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
            ChevronLeft;
            // @ts-ignore
            const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({}));
            const __VLS_112 = __VLS_111({}, ...__VLS_functionalComponentArgsRest(__VLS_111));
            for (const [value] of __VLS_vFor((__VLS_ctx.visiblePages(__VLS_ctx.taskPage, __VLS_ctx.taskPageCount)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!(__VLS_ctx.filteredTasks.length > __VLS_ctx.pageSize))
                                throw 0;
                            return (__VLS_ctx.taskPage = value);
                            // @ts-ignore
                            [taskPage, taskPage, taskPage, visiblePages, taskPageCount,];
                        } },
                    key: (value),
                    ...{ class: ({ active: __VLS_ctx.taskPage === value }) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                (value);
                // @ts-ignore
                [taskPage,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.filteredTasks.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.taskPage++);
                        // @ts-ignore
                        [taskPage,];
                    } },
                disabled: (__VLS_ctx.taskPage === __VLS_ctx.taskPageCount),
                title: "下一页",
            });
            let __VLS_115;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({}));
            const __VLS_117 = __VLS_116({}, ...__VLS_functionalComponentArgsRest(__VLS_116));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.filteredTasks.length);
        }
    }
    else if (__VLS_ctx.page === 'papers') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "content" },
        });
        /** @type {__VLS_StyleScopedClasses['content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "filter-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "search" },
        });
        /** @type {__VLS_StyleScopedClasses['search']} */ ;
        let __VLS_120;
        /** @ts-ignore @type { | typeof __VLS_components.Search} */
        Search;
        // @ts-ignore
        const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({}));
        const __VLS_122 = __VLS_121({}, ...__VLS_functionalComponentArgsRest(__VLS_121));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "搜索试卷名称、年级或学科",
        });
        (__VLS_ctx.paperSearch);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    return (__VLS_ctx.paperFilter = 'all');
                    // @ts-ignore
                    [page, filteredTasks, taskPage, taskPageCount, paperSearch, paperFilter,];
                } },
            ...{ class: "filter" },
            ...{ class: ({ active: __VLS_ctx.paperFilter === 'all' }) },
        });
        /** @type {__VLS_StyleScopedClasses['filter']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (__VLS_ctx.papers.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    return (__VLS_ctx.paperFilter = 'review');
                    // @ts-ignore
                    [papers, paperFilter, paperFilter,];
                } },
            ...{ class: "filter" },
            ...{ class: ({ active: __VLS_ctx.paperFilter === 'review' }) },
        });
        /** @type {__VLS_StyleScopedClasses['filter']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (__VLS_ctx.reviewPaperCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "paper-grid" },
        });
        /** @type {__VLS_StyleScopedClasses['paper-grid']} */ ;
        for (const [p] of __VLS_vFor((__VLS_ctx.pagedPapers))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        return (__VLS_ctx.openPaper(p));
                        // @ts-ignore
                        [openPaper, paperFilter, reviewPaperCount, pagedPapers,];
                    } },
                key: (p.id),
                ...{ class: "paper-card" },
            });
            /** @type {__VLS_StyleScopedClasses['paper-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "cover" },
            });
            /** @type {__VLS_StyleScopedClasses['cover']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (p.subject);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mini-paper" },
            });
            /** @type {__VLS_StyleScopedClasses['mini-paper']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (p.grade);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "card-body" },
            });
            /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status" },
                'data-status': (p.status),
            });
            /** @type {__VLS_StyleScopedClasses['status']} */ ;
            (p.status === 'processing' ? '解析中' : p.status === 'review' ? '待校对' : '可发行');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "paper-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['paper-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            (new Date(p.createdAt).toLocaleDateString());
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        return (__VLS_ctx.deletePaper(p));
                        // @ts-ignore
                        [deletePaper,];
                    } },
                ...{ class: "paper-delete" },
                title: "删除试卷",
                disabled: (__VLS_ctx.busy),
            });
            /** @type {__VLS_StyleScopedClasses['paper-delete']} */ ;
            let __VLS_125;
            /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
            Trash2;
            // @ts-ignore
            const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({}));
            const __VLS_127 = __VLS_126({}, ...__VLS_functionalComponentArgsRest(__VLS_126));
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
            (p.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (p.pageCount);
            (p.questionCount);
            (p.reviewedCount);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "meter" },
            });
            /** @type {__VLS_StyleScopedClasses['meter']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                ...{ style: ({ width: p.progress + '%' }) },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({});
            (p.status === 'processing' ? '查看解析进度' : p.status === 'ready' ? '查看已校对试题' : '进入校对');
            let __VLS_130;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({}));
            const __VLS_132 = __VLS_131({}, ...__VLS_functionalComponentArgsRest(__VLS_131));
            // @ts-ignore
            [busy,];
        }
        if (__VLS_ctx.filteredPapers.length > __VLS_ctx.paperPageSize) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
                ...{ class: "pagination" },
                'aria-label': "试卷列表分页",
            });
            /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!(__VLS_ctx.filteredPapers.length > __VLS_ctx.paperPageSize))
                            throw 0;
                        return (__VLS_ctx.paperPage--);
                        // @ts-ignore
                        [filteredPapers, paperPageSize, paperPage,];
                    } },
                disabled: (__VLS_ctx.paperPage === 1),
                title: "上一页",
            });
            let __VLS_135;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
            ChevronLeft;
            // @ts-ignore
            const __VLS_136 = __VLS_asFunctionalComponent1(__VLS_135, new __VLS_135({}));
            const __VLS_137 = __VLS_136({}, ...__VLS_functionalComponentArgsRest(__VLS_136));
            for (const [value] of __VLS_vFor((__VLS_ctx.visiblePages(__VLS_ctx.paperPage, __VLS_ctx.paperPageCount)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'papers'))
                                throw 0;
                            if (!(__VLS_ctx.filteredPapers.length > __VLS_ctx.paperPageSize))
                                throw 0;
                            return (__VLS_ctx.paperPage = value);
                            // @ts-ignore
                            [visiblePages, paperPage, paperPage, paperPage, paperPageCount,];
                        } },
                    key: (value),
                    ...{ class: ({ active: __VLS_ctx.paperPage === value }) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                (value);
                // @ts-ignore
                [paperPage,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!(__VLS_ctx.filteredPapers.length > __VLS_ctx.paperPageSize))
                            throw 0;
                        return (__VLS_ctx.paperPage++);
                        // @ts-ignore
                        [paperPage,];
                    } },
                disabled: (__VLS_ctx.paperPage === __VLS_ctx.paperPageCount),
                title: "下一页",
            });
            let __VLS_140;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_141 = __VLS_asFunctionalComponent1(__VLS_140, new __VLS_140({}));
            const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.filteredPapers.length);
        }
    }
    else if (__VLS_ctx.page === 'review') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "review-shell" },
        });
        /** @type {__VLS_StyleScopedClasses['review-shell']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "review-top" },
        });
        /** @type {__VLS_StyleScopedClasses['review-top']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'review'))
                        throw 0;
                    return (__VLS_ctx.page = 'papers');
                    // @ts-ignore
                    [page, page, filteredPapers, paperPage, paperPageCount,];
                } },
            ...{ class: "back" },
        });
        /** @type {__VLS_StyleScopedClasses['back']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.selectedPaper?.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (__VLS_ctx.selectedPaper?.grade);
        (__VLS_ctx.selectedPaper?.subject);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "review-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['review-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.refreshPaper) },
            ...{ class: "ghost" },
            disabled: (__VLS_ctx.busy),
        });
        /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
        let __VLS_145;
        /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
        RefreshCw;
        // @ts-ignore
        const __VLS_146 = __VLS_asFunctionalComponent1(__VLS_145, new __VLS_145({}));
        const __VLS_147 = __VLS_146({}, ...__VLS_functionalComponentArgsRest(__VLS_146));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.reparsePaper) },
            ...{ class: "reparse-button" },
            disabled: (__VLS_ctx.busy || __VLS_ctx.selectedPaper?.status === 'processing'),
        });
        /** @type {__VLS_StyleScopedClasses['reparse-button']} */ ;
        let __VLS_150;
        /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
        WandSparkles;
        // @ts-ignore
        const __VLS_151 = __VLS_asFunctionalComponent1(__VLS_150, new __VLS_150({}));
        const __VLS_152 = __VLS_151({}, ...__VLS_functionalComponentArgsRest(__VLS_151));
        (__VLS_ctx.busy ? '提交中' : '重新解析');
        if (__VLS_ctx.selectedPaper?.status === 'processing') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "processing" },
            });
            /** @type {__VLS_StyleScopedClasses['processing']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "ai-orb" },
            });
            /** @type {__VLS_StyleScopedClasses['ai-orb']} */ ;
            let __VLS_155;
            /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
            WandSparkles;
            // @ts-ignore
            const __VLS_156 = __VLS_asFunctionalComponent1(__VLS_155, new __VLS_155({}));
            const __VLS_157 = __VLS_156({}, ...__VLS_functionalComponentArgsRest(__VLS_156));
            __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (__VLS_ctx.selectedPaper.progress);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "big-meter" },
            });
            /** @type {__VLS_StyleScopedClasses['big-meter']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                ...{ style: ({ width: __VLS_ctx.selectedPaper.progress + '%' }) },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.refreshPaper) },
                ...{ class: "primary" },
            });
            /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "review-grid" },
            });
            /** @type {__VLS_StyleScopedClasses['review-grid']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
                ...{ class: "question-nav" },
            });
            /** @type {__VLS_StyleScopedClasses['question-nav']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "panel-head" },
            });
            /** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (__VLS_ctx.questions.length);
            for (const [q] of __VLS_vFor((__VLS_ctx.questions))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'papers'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'review'))
                                throw 0;
                            if (!!(__VLS_ctx.selectedPaper?.status === 'processing'))
                                throw 0;
                            return (__VLS_ctx.selectedQuestion = { ...q });
                            // @ts-ignore
                            [busy, busy, busy, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, refreshPaper, refreshPaper, reparsePaper, questions, questions, selectedQuestion,];
                        } },
                    key: (q.id),
                    ...{ class: ({ active: __VLS_ctx.selectedQuestion?.id === q.id }) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (q.number);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                (q.type);
                const __VLS_160 = MathPreview;
                // @ts-ignore
                const __VLS_161 = __VLS_asFunctionalComponent1(__VLS_160, new __VLS_160({
                    ...{ class: "question-nav-preview" },
                    text: (q.stem),
                }));
                const __VLS_162 = __VLS_161({
                    ...{ class: "question-nav-preview" },
                    text: (q.stem),
                }, ...__VLS_functionalComponentArgsRest(__VLS_161));
                /** @type {__VLS_StyleScopedClasses['question-nav-preview']} */ ;
                if (q.status === 'confirmed') {
                    let __VLS_165;
                    /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
                    CheckCircle2;
                    // @ts-ignore
                    const __VLS_166 = __VLS_asFunctionalComponent1(__VLS_165, new __VLS_165({}));
                    const __VLS_167 = __VLS_166({}, ...__VLS_functionalComponentArgsRest(__VLS_166));
                }
                // @ts-ignore
                [selectedQuestion,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "source-preview" },
            });
            /** @type {__VLS_StyleScopedClasses['source-preview']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "crop-placeholder" },
            });
            /** @type {__VLS_StyleScopedClasses['crop-placeholder']} */ ;
            let __VLS_170;
            /** @ts-ignore @type { | typeof __VLS_components.Archive} */
            Archive;
            // @ts-ignore
            const __VLS_171 = __VLS_asFunctionalComponent1(__VLS_170, new __VLS_170({}));
            const __VLS_172 = __VLS_171({}, ...__VLS_functionalComponentArgsRest(__VLS_171));
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            if (__VLS_ctx.selectedQuestion) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
                    ...{ class: "inspector" },
                });
                /** @type {__VLS_StyleScopedClasses['inspector']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "confidence" },
                });
                /** @type {__VLS_StyleScopedClasses['confidence']} */ ;
                let __VLS_175;
                /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
                WandSparkles;
                // @ts-ignore
                const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({}));
                const __VLS_177 = __VLS_176({}, ...__VLS_functionalComponentArgsRest(__VLS_176));
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                (__VLS_ctx.selectedQuestion.confidence);
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    type: "number",
                });
                (__VLS_ctx.selectedQuestion.number);
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (__VLS_ctx.selectedQuestion.type),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "formatted-question" },
                });
                /** @type {__VLS_StyleScopedClasses['formatted-question']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                const __VLS_180 = MathPreview;
                // @ts-ignore
                const __VLS_181 = __VLS_asFunctionalComponent1(__VLS_180, new __VLS_180({
                    text: (__VLS_ctx.selectedQuestion.stem),
                }));
                const __VLS_182 = __VLS_181({
                    text: (__VLS_ctx.selectedQuestion.stem),
                }, ...__VLS_functionalComponentArgsRest(__VLS_181));
                __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                    ...{ class: "source-editor" },
                });
                /** @type {__VLS_StyleScopedClasses['source-editor']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                    value: (__VLS_ctx.selectedQuestion.stem),
                    rows: "6",
                });
                if (__VLS_ctx.selectedQuestion.options?.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "formatted-question option-preview" },
                    });
                    /** @type {__VLS_StyleScopedClasses['formatted-question']} */ ;
                    /** @type {__VLS_StyleScopedClasses['option-preview']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    for (const [option, index] of __VLS_vFor((__VLS_ctx.selectedQuestion.options))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            key: (index),
                        });
                        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                        (String.fromCharCode(65 + index));
                        const __VLS_185 = MathPreview;
                        // @ts-ignore
                        const __VLS_186 = __VLS_asFunctionalComponent1(__VLS_185, new __VLS_185({
                            text: (option),
                        }));
                        const __VLS_187 = __VLS_186({
                            text: (option),
                        }, ...__VLS_functionalComponentArgsRest(__VLS_186));
                        // @ts-ignore
                        [selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion,];
                    }
                }
                if (__VLS_ctx.selectedQuestion.options?.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                        ...{ class: "source-editor option-editor" },
                    });
                    /** @type {__VLS_StyleScopedClasses['source-editor']} */ ;
                    /** @type {__VLS_StyleScopedClasses['option-editor']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
                    for (const [option, index] of __VLS_vFor((__VLS_ctx.selectedQuestion.options))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                            key: (index),
                        });
                        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                        (String.fromCharCode(65 + index));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                            value: (__VLS_ctx.selectedQuestion.options[index]),
                            rows: "2",
                        });
                        // @ts-ignore
                        [selectedQuestion, selectedQuestion, selectedQuestion,];
                    }
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "formatted-question compact" },
                });
                /** @type {__VLS_StyleScopedClasses['formatted-question']} */ ;
                /** @type {__VLS_StyleScopedClasses['compact']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                const __VLS_190 = MathPreview;
                // @ts-ignore
                const __VLS_191 = __VLS_asFunctionalComponent1(__VLS_190, new __VLS_190({
                    text: (__VLS_ctx.selectedQuestion.answer),
                }));
                const __VLS_192 = __VLS_191({
                    text: (__VLS_ctx.selectedQuestion.answer),
                }, ...__VLS_functionalComponentArgsRest(__VLS_191));
                __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                    ...{ class: "source-editor" },
                });
                /** @type {__VLS_StyleScopedClasses['source-editor']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                    value: (__VLS_ctx.selectedQuestion.answer),
                    rows: "3",
                });
                if (__VLS_ctx.selectedQuestion.analysis) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "formatted-question compact" },
                    });
                    /** @type {__VLS_StyleScopedClasses['formatted-question']} */ ;
                    /** @type {__VLS_StyleScopedClasses['compact']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    const __VLS_195 = MathPreview;
                    // @ts-ignore
                    const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
                        text: (__VLS_ctx.selectedQuestion.analysis),
                    }));
                    const __VLS_197 = __VLS_196({
                        text: (__VLS_ctx.selectedQuestion.analysis),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_196));
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                    ...{ class: "source-editor" },
                });
                /** @type {__VLS_StyleScopedClasses['source-editor']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                    value: (__VLS_ctx.selectedQuestion.analysis),
                    rows: "5",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (__VLS_ctx.selectedQuestion.difficulty),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.saveQuestion) },
                    ...{ class: "primary wide" },
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                /** @type {__VLS_StyleScopedClasses['wide']} */ ;
                let __VLS_200;
                /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
                CheckCircle2;
                // @ts-ignore
                const __VLS_201 = __VLS_asFunctionalComponent1(__VLS_200, new __VLS_200({}));
                const __VLS_202 = __VLS_201({}, ...__VLS_functionalComponentArgsRest(__VLS_201));
            }
        }
    }
    else if (__VLS_ctx.page === 'questions') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "question-library" },
        });
        /** @type {__VLS_StyleScopedClasses['question-library']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "knowledge-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "knowledge-title" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        let __VLS_205;
        /** @ts-ignore @type { | typeof __VLS_components.Tags} */
        Tags;
        // @ts-ignore
        const __VLS_206 = __VLS_asFunctionalComponent1(__VLS_205, new __VLS_205({}));
        const __VLS_207 = __VLS_206({}, ...__VLS_functionalComponentArgsRest(__VLS_206));
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.knowledgePoints.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'review'))
                        throw 0;
                    if (!(__VLS_ctx.page === 'questions'))
                        throw 0;
                    return (__VLS_ctx.selectedKnowledgePoint = '');
                    // @ts-ignore
                    [page, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, saveQuestion, knowledgePoints, selectedKnowledgePoint,];
                } },
            ...{ class: "knowledge-all" },
            ...{ class: ({ active: !__VLS_ctx.selectedKnowledgePoint }) },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.confirmedQuestions.length);
        for (const [root] of __VLS_vFor((__VLS_ctx.rootKnowledgePoints))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (root.id),
                ...{ class: "knowledge-group" },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'review'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'questions'))
                            throw 0;
                        return (__VLS_ctx.selectedKnowledgePoint = root.id);
                        // @ts-ignore
                        [confirmedQuestions, selectedKnowledgePoint, selectedKnowledgePoint, rootKnowledgePoints,];
                    } },
                ...{ class: ({ active: __VLS_ctx.selectedKnowledgePoint === root.id }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'review'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'questions'))
                            throw 0;
                        return (__VLS_ctx.toggleKnowledge(root.id));
                        // @ts-ignore
                        [selectedKnowledgePoint, toggleKnowledge,];
                    } },
                ...{ class: "knowledge-toggle" },
                ...{ class: ({ expanded: __VLS_ctx.expandedKnowledge.has(root.id) }) },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-toggle']} */ ;
            /** @type {__VLS_StyleScopedClasses['expanded']} */ ;
            let __VLS_210;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_211 = __VLS_asFunctionalComponent1(__VLS_210, new __VLS_210({}));
            const __VLS_212 = __VLS_211({}, ...__VLS_functionalComponentArgsRest(__VLS_211));
            (root.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (root.questionCount);
            if (__VLS_ctx.expandedKnowledge.has(root.id)) {
                for (const [child] of __VLS_vFor((__VLS_ctx.knowledgeChildren(root.id)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.expandedKnowledge.has(root.id)))
                                    throw 0;
                                return (__VLS_ctx.selectedKnowledgePoint = child.id);
                                // @ts-ignore
                                [selectedKnowledgePoint, expandedKnowledge, expandedKnowledge, knowledgeChildren,];
                            } },
                        key: (child.id),
                        ...{ class: "knowledge-child" },
                        ...{ class: ({ active: __VLS_ctx.selectedKnowledgePoint === child.id }) },
                    });
                    /** @type {__VLS_StyleScopedClasses['knowledge-child']} */ ;
                    /** @type {__VLS_StyleScopedClasses['active']} */ ;
                    (child.name);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                    (child.questionCount);
                    // @ts-ignore
                    [selectedKnowledgePoint,];
                }
            }
            // @ts-ignore
            [];
        }
        if (!__VLS_ctx.knowledgePoints.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "knowledge-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-empty']} */ ;
            let __VLS_215;
            /** @ts-ignore @type { | typeof __VLS_components.Tags} */
            Tags;
            // @ts-ignore
            const __VLS_216 = __VLS_asFunctionalComponent1(__VLS_215, new __VLS_215({}));
            const __VLS_217 = __VLS_216({}, ...__VLS_functionalComponentArgsRest(__VLS_216));
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: (__VLS_ctx.createKnowledgePoint) },
            ...{ class: "knowledge-create" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-create']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: (__VLS_ctx.selectedKnowledgePoint ? '新增子知识点' : '新增知识点'),
        });
        (__VLS_ctx.newKnowledgeName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            disabled: (__VLS_ctx.busy || !__VLS_ctx.newKnowledgeName.trim()),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "question-list-area" },
        });
        /** @type {__VLS_StyleScopedClasses['question-list-area']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "question-list-tools" },
        });
        /** @type {__VLS_StyleScopedClasses['question-list-tools']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "search" },
        });
        /** @type {__VLS_StyleScopedClasses['search']} */ ;
        let __VLS_220;
        /** @ts-ignore @type { | typeof __VLS_components.Search} */
        Search;
        // @ts-ignore
        const __VLS_221 = __VLS_asFunctionalComponent1(__VLS_220, new __VLS_220({}));
        const __VLS_222 = __VLS_221({}, ...__VLS_functionalComponentArgsRest(__VLS_221));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "搜索题干或来源试卷",
        });
        (__VLS_ctx.questionSearch);
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.questionType),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.questionDifficulty),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.filteredQuestions.length);
        for (const [q] of __VLS_vFor((__VLS_ctx.pagedQuestions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (q.id),
                ...{ class: "question-list-card" },
            });
            /** @type {__VLS_StyleScopedClasses['question-list-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "question-card-head" },
            });
            /** @type {__VLS_StyleScopedClasses['question-card-head']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "question-number" },
            });
            /** @type {__VLS_StyleScopedClasses['question-number']} */ ;
            (q.number);
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (q.type);
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                'data-level': (q.difficulty),
            });
            (q.difficulty);
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            (q.sourceGrade);
            (q.sourceSubject);
            (q.sourceTitle);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'review'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'questions'))
                            throw 0;
                        return (__VLS_ctx.editingKnowledgeQuestion = __VLS_ctx.editingKnowledgeQuestion === q.id ? null : q.id);
                        // @ts-ignore
                        [busy, knowledgePoints, selectedKnowledgePoint, createKnowledgePoint, newKnowledgeName, newKnowledgeName, questionSearch, questionType, questionDifficulty, filteredQuestions, pagedQuestions, editingKnowledgeQuestion, editingKnowledgeQuestion,];
                    } },
            });
            let __VLS_225;
            /** @ts-ignore @type { | typeof __VLS_components.Tags} */
            Tags;
            // @ts-ignore
            const __VLS_226 = __VLS_asFunctionalComponent1(__VLS_225, new __VLS_225({}));
            const __VLS_227 = __VLS_226({}, ...__VLS_functionalComponentArgsRest(__VLS_226));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "question-stem" },
            });
            /** @type {__VLS_StyleScopedClasses['question-stem']} */ ;
            const __VLS_230 = MathPreview;
            // @ts-ignore
            const __VLS_231 = __VLS_asFunctionalComponent1(__VLS_230, new __VLS_230({
                text: (q.stem),
            }));
            const __VLS_232 = __VLS_231({
                text: (q.stem),
            }, ...__VLS_functionalComponentArgsRest(__VLS_231));
            if (__VLS_ctx.questionImages(q).length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "question-images" },
                });
                /** @type {__VLS_StyleScopedClasses['question-images']} */ ;
                for (const [path] of __VLS_vFor((__VLS_ctx.questionImages(q)))) {
                    const __VLS_235 = AuthenticatedImage;
                    // @ts-ignore
                    const __VLS_236 = __VLS_asFunctionalComponent1(__VLS_235, new __VLS_235({
                        key: (path),
                        path: (path),
                        alt: "题目图片",
                    }));
                    const __VLS_237 = __VLS_236({
                        key: (path),
                        path: (path),
                        alt: "题目图片",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_236));
                    // @ts-ignore
                    [questionImages, questionImages,];
                }
            }
            if (q.options?.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "question-options" },
                });
                /** @type {__VLS_StyleScopedClasses['question-options']} */ ;
                for (const [option, index] of __VLS_vFor((q.options))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        key: (index),
                    });
                    (String.fromCharCode(65 + index));
                    const __VLS_240 = MathPreview;
                    // @ts-ignore
                    const __VLS_241 = __VLS_asFunctionalComponent1(__VLS_240, new __VLS_240({
                        text: (option),
                    }));
                    const __VLS_242 = __VLS_241({
                        text: (option),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_241));
                    // @ts-ignore
                    [];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "question-card-foot" },
            });
            /** @type {__VLS_StyleScopedClasses['question-card-foot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            for (const [id] of __VLS_vFor((q.knowledgePointIds))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (id),
                });
                (__VLS_ctx.knowledgeName(id));
                // @ts-ignore
                [knowledgeName,];
            }
            if (!q.knowledgePointIds?.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            (q.answer || '—');
            if (__VLS_ctx.editingKnowledgeQuestion === q.id) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "knowledge-picker" },
                });
                /** @type {__VLS_StyleScopedClasses['knowledge-picker']} */ ;
                for (const [point] of __VLS_vFor((__VLS_ctx.knowledgePoints))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        key: (point.id),
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        ...{ onChange: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.editingKnowledgeQuestion === q.id))
                                    throw 0;
                                return (__VLS_ctx.toggleQuestionKnowledge(q, point.id));
                                // @ts-ignore
                                [knowledgePoints, editingKnowledgeQuestion, toggleQuestionKnowledge,];
                            } },
                        type: "checkbox",
                        checked: (q.knowledgePointIds?.includes(point.id)),
                    });
                    (point.name);
                    // @ts-ignore
                    [];
                }
                if (!__VLS_ctx.knowledgePoints.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                }
            }
            // @ts-ignore
            [knowledgePoints,];
        }
        if (!__VLS_ctx.filteredQuestions.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "question-list-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['question-list-empty']} */ ;
            let __VLS_245;
            /** @ts-ignore @type { | typeof __VLS_components.Search} */
            Search;
            // @ts-ignore
            const __VLS_246 = __VLS_asFunctionalComponent1(__VLS_245, new __VLS_245({}));
            const __VLS_247 = __VLS_246({}, ...__VLS_functionalComponentArgsRest(__VLS_246));
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        if (__VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
                ...{ class: "pagination" },
                'aria-label': "试题列表分页",
            });
            /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'review'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'questions'))
                            throw 0;
                        if (!(__VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.questionPage--);
                        // @ts-ignore
                        [pageSize, filteredQuestions, filteredQuestions, questionPage,];
                    } },
                disabled: (__VLS_ctx.questionPage === 1),
                title: "上一页",
            });
            let __VLS_250;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
            ChevronLeft;
            // @ts-ignore
            const __VLS_251 = __VLS_asFunctionalComponent1(__VLS_250, new __VLS_250({}));
            const __VLS_252 = __VLS_251({}, ...__VLS_functionalComponentArgsRest(__VLS_251));
            for (const [value] of __VLS_vFor((__VLS_ctx.visiblePages(__VLS_ctx.questionPage, __VLS_ctx.questionPageCount)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'papers'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'review'))
                                throw 0;
                            if (!(__VLS_ctx.page === 'questions'))
                                throw 0;
                            if (!(__VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
                                throw 0;
                            return (__VLS_ctx.questionPage = value);
                            // @ts-ignore
                            [visiblePages, questionPage, questionPage, questionPage, questionPageCount,];
                        } },
                    key: (value),
                    ...{ class: ({ active: __VLS_ctx.questionPage === value }) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                (value);
                // @ts-ignore
                [questionPage,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'dashboard'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'tasks'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'papers'))
                            throw 0;
                        if (!!(__VLS_ctx.page === 'review'))
                            throw 0;
                        if (!(__VLS_ctx.page === 'questions'))
                            throw 0;
                        if (!(__VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.questionPage++);
                        // @ts-ignore
                        [questionPage,];
                    } },
                disabled: (__VLS_ctx.questionPage === __VLS_ctx.questionPageCount),
                title: "下一页",
            });
            let __VLS_255;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_256 = __VLS_asFunctionalComponent1(__VLS_255, new __VLS_255({}));
            const __VLS_257 = __VLS_256({}, ...__VLS_functionalComponentArgsRest(__VLS_256));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.filteredQuestions.length);
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "content sets-page" },
        });
        /** @type {__VLS_StyleScopedClasses['content']} */ ;
        /** @type {__VLS_StyleScopedClasses['sets-page']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "set-management-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['set-management-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "set-tabs" },
        });
        /** @type {__VLS_StyleScopedClasses['set-tabs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'review'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'questions'))
                        throw 0;
                    return (__VLS_ctx.setTab = 'mine');
                    // @ts-ignore
                    [filteredQuestions, questionPage, questionPageCount, setTab,];
                } },
            ...{ class: ({ active: __VLS_ctx.setTab === 'mine' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        let __VLS_260;
        /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
        BookOpenCheck;
        // @ts-ignore
        const __VLS_261 = __VLS_asFunctionalComponent1(__VLS_260, new __VLS_260({}));
        const __VLS_262 = __VLS_261({}, ...__VLS_functionalComponentArgsRest(__VLS_261));
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.sets.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'review'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'questions'))
                        throw 0;
                    return (__VLS_ctx.setTab = 'sales');
                    // @ts-ignore
                    [setTab, setTab, sets,];
                } },
            ...{ class: ({ active: __VLS_ctx.setTab === 'sales' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        let __VLS_265;
        /** @ts-ignore @type { | typeof __VLS_components.ShoppingBag} */
        ShoppingBag;
        // @ts-ignore
        const __VLS_266 = __VLS_asFunctionalComponent1(__VLS_265, new __VLS_265({}));
        const __VLS_267 = __VLS_266({}, ...__VLS_functionalComponentArgsRest(__VLS_266));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'dashboard'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'tasks'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'papers'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'review'))
                        throw 0;
                    if (!!(__VLS_ctx.page === 'questions'))
                        throw 0;
                    return (__VLS_ctx.openSetEditor());
                    // @ts-ignore
                    [openSetEditor, setTab,];
                } },
            ...{ class: "primary" },
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        let __VLS_270;
        /** @ts-ignore @type { | typeof __VLS_components.Plus} */
        Plus;
        // @ts-ignore
        const __VLS_271 = __VLS_asFunctionalComponent1(__VLS_270, new __VLS_270({}));
        const __VLS_272 = __VLS_271({}, ...__VLS_functionalComponentArgsRest(__VLS_271));
        if (__VLS_ctx.setTab === 'mine') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "set-list-panel" },
            });
            /** @type {__VLS_StyleScopedClasses['set-list-panel']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "set-list-header" },
            });
            /** @type {__VLS_StyleScopedClasses['set-list-header']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            for (const [s] of __VLS_vFor((__VLS_ctx.sets))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                    key: (s.id),
                    ...{ class: "set-list-row" },
                });
                /** @type {__VLS_StyleScopedClasses['set-list-row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "set-list-title" },
                });
                /** @type {__VLS_StyleScopedClasses['set-list-title']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                let __VLS_275;
                /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
                BookOpenCheck;
                // @ts-ignore
                const __VLS_276 = __VLS_asFunctionalComponent1(__VLS_275, new __VLS_275({}));
                const __VLS_277 = __VLS_276({}, ...__VLS_functionalComponentArgsRest(__VLS_276));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                (s.title);
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (s.description || '尚未填写试题集介绍');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "set-dimension" },
                });
                /** @type {__VLS_StyleScopedClasses['set-dimension']} */ ;
                (s.topicLabel || s.subject + ' · ' + s.grade);
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (s.collectionType === 'paper' ? '完整试卷' : s.collectionType === 'question_type' ? '题型精选' : s.collectionType === 'mixed' ? '混合精选' : '知识专题');
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                (s.questionCount);
                __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
                (s.price);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                    ...{ class: "status" },
                    'data-status': (s.status),
                });
                /** @type {__VLS_StyleScopedClasses['status']} */ ;
                (s.status === 'published' ? '销售中' : '草稿');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "set-row-actions" },
                });
                /** @type {__VLS_StyleScopedClasses['set-row-actions']} */ ;
                if (s.status === 'published') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (__VLS_ctx.openTeacherStore) },
                        ...{ class: "ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.setTab === 'mine'))
                                    throw 0;
                                if (!(s.status === 'published'))
                                    throw 0;
                                return (__VLS_ctx.unpublish(s));
                                // @ts-ignore
                                [setTab, sets, openTeacherStore, unpublish,];
                            } },
                        ...{ class: "offline-button" },
                        disabled: (__VLS_ctx.busy),
                    });
                    /** @type {__VLS_StyleScopedClasses['offline-button']} */ ;
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.setTab === 'mine'))
                                    throw 0;
                                if (!!(s.status === 'published'))
                                    throw 0;
                                return (__VLS_ctx.openSetEditor(s));
                                // @ts-ignore
                                [busy, openSetEditor,];
                            } },
                        ...{ class: "ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.setTab === 'mine'))
                                    throw 0;
                                if (!!(s.status === 'published'))
                                    throw 0;
                                return (__VLS_ctx.deleteSet(s));
                                // @ts-ignore
                                [deleteSet,];
                            } },
                        ...{ class: "set-delete-button" },
                        disabled: (__VLS_ctx.busy),
                        title: "删除试题集",
                    });
                    /** @type {__VLS_StyleScopedClasses['set-delete-button']} */ ;
                    let __VLS_280;
                    /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
                    Trash2;
                    // @ts-ignore
                    const __VLS_281 = __VLS_asFunctionalComponent1(__VLS_280, new __VLS_280({}));
                    const __VLS_282 = __VLS_281({}, ...__VLS_functionalComponentArgsRest(__VLS_281));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                    throw 0;
                                if (!!(!__VLS_ctx.current))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'dashboard'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'tasks'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'papers'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'review'))
                                    throw 0;
                                if (!!(__VLS_ctx.page === 'questions'))
                                    throw 0;
                                if (!(__VLS_ctx.setTab === 'mine'))
                                    throw 0;
                                if (!!(s.status === 'published'))
                                    throw 0;
                                return (__VLS_ctx.publish(s));
                                // @ts-ignore
                                [busy, publish,];
                            } },
                        ...{ class: "primary" },
                    });
                    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                }
                // @ts-ignore
                [];
            }
            if (!__VLS_ctx.sets.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "set-list-empty" },
                });
                /** @type {__VLS_StyleScopedClasses['set-list-empty']} */ ;
                let __VLS_285;
                /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
                BookOpenCheck;
                // @ts-ignore
                const __VLS_286 = __VLS_asFunctionalComponent1(__VLS_285, new __VLS_285({}));
                const __VLS_287 = __VLS_286({}, ...__VLS_functionalComponentArgsRest(__VLS_286));
                __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                                throw 0;
                            if (!!(!__VLS_ctx.current))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'dashboard'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'tasks'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'papers'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'review'))
                                throw 0;
                            if (!!(__VLS_ctx.page === 'questions'))
                                throw 0;
                            if (!(__VLS_ctx.setTab === 'mine'))
                                throw 0;
                            if (!(!__VLS_ctx.sets.length))
                                throw 0;
                            return (__VLS_ctx.openSetEditor());
                            // @ts-ignore
                            [openSetEditor, sets,];
                        } },
                    ...{ class: "primary" },
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                let __VLS_290;
                /** @ts-ignore @type { | typeof __VLS_components.Plus} */
                Plus;
                // @ts-ignore
                const __VLS_291 = __VLS_asFunctionalComponent1(__VLS_290, new __VLS_290({}));
                const __VLS_292 = __VLS_291({}, ...__VLS_functionalComponentArgsRest(__VLS_291));
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sales-panel" },
            });
            /** @type {__VLS_StyleScopedClasses['sales-panel']} */ ;
            let __VLS_295;
            /** @ts-ignore @type { | typeof __VLS_components.ShoppingBag} */
            ShoppingBag;
            // @ts-ignore
            const __VLS_296 = __VLS_asFunctionalComponent1(__VLS_295, new __VLS_295({}));
            const __VLS_297 = __VLS_296({}, ...__VLS_functionalComponentArgsRest(__VLS_296));
            __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (__VLS_ctx.sets.filter(item => item.status === 'published').length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        }
    }
    if (__VLS_ctx.uploadOpen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.uploadOpen))
                        throw 0;
                    return (__VLS_ctx.uploadOpen = false);
                    // @ts-ignore
                    [uploadOpen, uploadOpen, sets,];
                } },
            ...{ class: "modal-mask" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-mask']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: (__VLS_ctx.submitUpload) },
            ...{ class: "modal" },
        });
        /** @type {__VLS_StyleScopedClasses['modal']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-head" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "eyebrow" },
        });
        /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.uploadOpen))
                        throw 0;
                    return (__VLS_ctx.uploadOpen = false);
                    // @ts-ignore
                    [uploadOpen, submitUpload,];
                } },
            type: "button",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "dropzone" },
        });
        /** @type {__VLS_StyleScopedClasses['dropzone']} */ ;
        let __VLS_300;
        /** @ts-ignore @type { | typeof __VLS_components.UploadCloud} */
        UploadCloud;
        // @ts-ignore
        const __VLS_301 = __VLS_asFunctionalComponent1(__VLS_300, new __VLS_300({}));
        const __VLS_302 = __VLS_301({}, ...__VLS_functionalComponentArgsRest(__VLS_301));
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (...[$event]) => {
                    if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                        throw 0;
                    if (!!(!__VLS_ctx.current))
                        throw 0;
                    if (!(__VLS_ctx.uploadOpen))
                        throw 0;
                    return (__VLS_ctx.files = Array.from($event.target.files || []));
                    // @ts-ignore
                    [files,];
                } },
            type: "file",
            accept: "application/pdf,image/*,.zip,application/zip,application/x-zip-compressed",
            multiple: true,
        });
        if (__VLS_ctx.files.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
            (__VLS_ctx.files.length);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            required: true,
            placeholder: "例如：2026 杭州中考数学模拟卷",
        });
        (__VLS_ctx.upload.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-row" },
        });
        /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.upload.subject),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.upload.grade),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "primary wide" },
            disabled: (__VLS_ctx.busy),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
    }
    if (__VLS_ctx.page === 'assembly') {
        const __VLS_305 = QuestionSetAssembler;
        // @ts-ignore
        const __VLS_306 = __VLS_asFunctionalComponent1(__VLS_305, new __VLS_305({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            questions: (__VLS_ctx.confirmedQuestions),
            initial: (__VLS_ctx.setForm),
            editing: (!!__VLS_ctx.editingSetId),
            saving: (__VLS_ctx.busy),
        }));
        const __VLS_307 = __VLS_306({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            questions: (__VLS_ctx.confirmedQuestions),
            initial: (__VLS_ctx.setForm),
            editing: (!!__VLS_ctx.editingSetId),
            saving: (__VLS_ctx.busy),
        }, ...__VLS_functionalComponentArgsRest(__VLS_306));
        let __VLS_310;
        const __VLS_311 = {
            /** @type {typeof __VLS_310.close} */
            onClose: (__VLS_ctx.closeSetEditor),
        };
        const __VLS_312 = {
            /** @type {typeof __VLS_310.save} */
            onSave: (__VLS_ctx.saveSetForm),
        };
        var __VLS_308;
        var __VLS_309;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedQuestion?.boundaryQuality) {
        let __VLS_313;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_314 = __VLS_asFunctionalComponent1(__VLS_313, new __VLS_313({
            to: ".inspector",
        }));
        const __VLS_315 = __VLS_314({
            to: ".inspector",
        }, ...__VLS_functionalComponentArgsRest(__VLS_314));
        const { default: __VLS_318 } = __VLS_316.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "boundary-quality" },
            'data-review': (__VLS_ctx.selectedQuestion.boundaryQuality.requiresManualReview),
        });
        /** @type {__VLS_StyleScopedClasses['boundary-quality']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.selectedQuestion.boundaryQuality.requiresManualReview) {
            let __VLS_319;
            /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
            AlertTriangle;
            // @ts-ignore
            const __VLS_320 = __VLS_asFunctionalComponent1(__VLS_319, new __VLS_319({}));
            const __VLS_321 = __VLS_320({}, ...__VLS_functionalComponentArgsRest(__VLS_320));
        }
        else {
            let __VLS_324;
            /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
            CheckCircle2;
            // @ts-ignore
            const __VLS_325 = __VLS_asFunctionalComponent1(__VLS_324, new __VLS_324({}));
            const __VLS_326 = __VLS_325({}, ...__VLS_functionalComponentArgsRest(__VLS_325));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.selectedQuestion.boundaryQuality.score);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.selectedQuestion.boundaryQuality.crossPage ? '该题跨页，已合并多个原卷区域' : '该题位于单页原卷区域');
        for (const [item] of __VLS_vFor((__VLS_ctx.selectedQuestion.warnings))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (item),
            });
            (__VLS_ctx.warningLabel(item));
            // @ts-ignore
            [busy, busy, page, page, confirmedQuestions, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, files, files, upload, upload, upload, setForm, editingSetId, closeSetEditor, saveSetForm, warningLabel,];
        }
        // @ts-ignore
        [];
        var __VLS_316;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedQuestion) {
        let __VLS_329;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_330 = __VLS_asFunctionalComponent1(__VLS_329, new __VLS_329({
            to: ".review-actions",
        }));
        const __VLS_331 = __VLS_330({
            to: ".review-actions",
        }, ...__VLS_functionalComponentArgsRest(__VLS_330));
        const { default: __VLS_334 } = __VLS_332.slots;
        if (__VLS_ctx.selectedQuestion.figureUrls?.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                            throw 0;
                        if (!!(!__VLS_ctx.current))
                            throw 0;
                        if (!(__VLS_ctx.page === 'review' && __VLS_ctx.selectedQuestion))
                            throw 0;
                        if (!(__VLS_ctx.selectedQuestion.figureUrls?.length))
                            throw 0;
                        return (__VLS_ctx.layoutOpen = true);
                        // @ts-ignore
                        [page, selectedQuestion, selectedQuestion, layoutOpen,];
                    } },
                ...{ class: "layout-button" },
            });
            /** @type {__VLS_StyleScopedClasses['layout-button']} */ ;
            let __VLS_335;
            /** @ts-ignore @type { | typeof __VLS_components.Settings2} */
            Settings2;
            // @ts-ignore
            const __VLS_336 = __VLS_asFunctionalComponent1(__VLS_335, new __VLS_335({}));
            const __VLS_337 = __VLS_336({}, ...__VLS_functionalComponentArgsRest(__VLS_336));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveQuestion) },
            ...{ class: "primary save-question-top" },
            disabled: (__VLS_ctx.busy),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['save-question-top']} */ ;
        let __VLS_340;
        /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_341 = __VLS_asFunctionalComponent1(__VLS_340, new __VLS_340({}));
        const __VLS_342 = __VLS_341({}, ...__VLS_functionalComponentArgsRest(__VLS_341));
        (__VLS_ctx.busy ? '保存中' : '确认并保存题目');
        // @ts-ignore
        [busy, busy, saveQuestion,];
        var __VLS_332;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedPaper?.status === 'processing' && __VLS_ctx.processingDetail) {
        let __VLS_345;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_346 = __VLS_asFunctionalComponent1(__VLS_345, new __VLS_345({
            to: ".processing",
        }));
        const __VLS_347 = __VLS_346({
            to: ".processing",
        }, ...__VLS_functionalComponentArgsRest(__VLS_346));
        const { default: __VLS_350 } = __VLS_348.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pipeline-detail" },
        });
        /** @type {__VLS_StyleScopedClasses['pipeline-detail']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.processingDetail.stages))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (item.stage + '-' + item.attempt),
                ...{ class: "pipeline-stage" },
                'data-status': (item.status),
            });
            /** @type {__VLS_StyleScopedClasses['pipeline-stage']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (item.stage);
            __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            (item.provider || '系统处理');
            (item.attempt);
            __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
            (item.status === 'completed' ? '完成' : item.status === 'failed' ? '失败' : '进行中');
            // @ts-ignore
            [page, selectedPaper, processingDetail, processingDetail,];
        }
        if (__VLS_ctx.processingDetail.pages.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "page-routing" },
            });
            /** @type {__VLS_StyleScopedClasses['page-routing']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            for (const [item] of __VLS_vFor((__VLS_ctx.processingDetail.pages))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (item.pageNumber),
                });
                (item.pageNumber);
                (item.strategy === 'native_with_formula_ocr' ? '原生文本 + 公式 OCR' : item.strategy === 'native' ? '原生文本' : '整页 OCR');
                // @ts-ignore
                [processingDetail, processingDetail,];
            }
        }
        // @ts-ignore
        [];
        var __VLS_348;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedPaper && __VLS_ctx.selectedQuestion) {
        let __VLS_351;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_352 = __VLS_asFunctionalComponent1(__VLS_351, new __VLS_351({
            to: ".crop-placeholder",
        }));
        const __VLS_353 = __VLS_352({
            to: ".crop-placeholder",
        }, ...__VLS_functionalComponentArgsRest(__VLS_352));
        const { default: __VLS_356 } = __VLS_354.slots;
        const __VLS_357 = SourcePaperPreview;
        // @ts-ignore
        const __VLS_358 = __VLS_asFunctionalComponent1(__VLS_357, new __VLS_357({
            ...{ 'onUpdate:regions': {} },
            ...{ 'onRecognize': {} },
            paper: (__VLS_ctx.selectedPaper),
            question: (__VLS_ctx.selectedQuestion),
            recognizing: (__VLS_ctx.recognizing),
        }));
        const __VLS_359 = __VLS_358({
            ...{ 'onUpdate:regions': {} },
            ...{ 'onRecognize': {} },
            paper: (__VLS_ctx.selectedPaper),
            question: (__VLS_ctx.selectedQuestion),
            recognizing: (__VLS_ctx.recognizing),
        }, ...__VLS_functionalComponentArgsRest(__VLS_358));
        let __VLS_362;
        const __VLS_363 = {
            /** @type {typeof __VLS_362.'update:regions'} */
            'onUpdate:regions': (__VLS_ctx.updateRegions),
        };
        const __VLS_364 = {
            /** @type {typeof __VLS_362.recognize} */
            onRecognize: (__VLS_ctx.reprocessSelected),
        };
        var __VLS_360;
        var __VLS_361;
        // @ts-ignore
        [page, selectedPaper, selectedPaper, selectedQuestion, selectedQuestion, recognizing, updateRegions, reprocessSelected,];
        var __VLS_354;
    }
    if (__VLS_ctx.layoutOpen && __VLS_ctx.selectedQuestion) {
        const __VLS_365 = LayoutCanvasEditor;
        // @ts-ignore
        const __VLS_366 = __VLS_asFunctionalComponent1(__VLS_365, new __VLS_365({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            question: (__VLS_ctx.selectedQuestion),
            saving: (__VLS_ctx.busy),
        }));
        const __VLS_367 = __VLS_366({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            question: (__VLS_ctx.selectedQuestion),
            saving: (__VLS_ctx.busy),
        }, ...__VLS_functionalComponentArgsRest(__VLS_366));
        let __VLS_370;
        const __VLS_371 = {
            /** @type {typeof __VLS_370.close} */
            onClose: (...[$event]) => {
                if (!!(!__VLS_ctx.current && !__VLS_ctx.showAuth))
                    throw 0;
                if (!!(!__VLS_ctx.current))
                    throw 0;
                if (!(__VLS_ctx.layoutOpen && __VLS_ctx.selectedQuestion))
                    throw 0;
                return (__VLS_ctx.layoutOpen = false);
                // @ts-ignore
                [busy, selectedQuestion, selectedQuestion, layoutOpen, layoutOpen,];
            },
        };
        const __VLS_372 = {
            /** @type {typeof __VLS_370.save} */
            onSave: (__VLS_ctx.saveLayout),
        };
        var __VLS_368;
        var __VLS_369;
    }
    if (__VLS_ctx.toast) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "toast" },
        });
        /** @type {__VLS_StyleScopedClasses['toast']} */ ;
        (__VLS_ctx.toast);
    }
}
// @ts-ignore
[saveLayout, toast, toast,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
