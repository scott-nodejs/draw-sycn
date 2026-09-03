import { computed, onMounted, ref, watch } from 'vue';
import { AlertTriangle, Archive, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, FilePenLine, FileStack, LayoutDashboard, List, LocateFixed, LogOut, PanelsTopLeft, Pause, Play, Plus, RefreshCw, Search, Settings2, ShoppingBag, Tags, Trash2, UploadCloud, WandSparkles } from 'lucide-vue-next';
import { api, optionText, session } from './api';
import SourcePaperPreview from './components/SourcePaperPreview.vue';
import MathPreview from './components/MathPreview.vue';
import LayoutCanvasEditor from './components/LayoutCanvasEditor.vue';
import QuestionSetAssembler from './components/QuestionSetAssembler.vue';
import QuestionFinalPreview from './components/QuestionFinalPreview.vue';
import QuestionAnswerEditor from './components/QuestionAnswerEditor.vue';
import QuestionCompareView from './components/QuestionCompareView.vue';
import PaperWorkspaceView from './components/PaperWorkspaceView.vue';
const current = ref(session.get()), page = ref('dashboard'), papers = ref([]), questions = ref([]), confirmedQuestions = ref([]), sets = ref([]), selectedPaper = ref(null), selectedQuestion = ref(null), busy = ref(false), error = ref(''), toast = ref('');
const processingDetail = ref(null);
const regionEditing = ref(false);
const recognizing = ref(false);
const layoutOpen = ref(false);
const authMode = ref('login'), auth = ref({ name: '', account: '', password: '' });
const showAuth = ref(false);
const uploadOpen = ref(false), files = ref([]), upload = ref({ title: '', subject: '数学', grade: '初三' }), uploadError = ref('');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const uploadSize = computed(() => files.value.reduce((total, file) => total + file.size, 0));
const setOpen = ref(false), setForm = ref({ title: '', description: '', subject: '数学', grade: '初三', collectionType: 'topic', topicLabel: '', price: 19.9, questionIds: [] });
const setTab = ref('mine'), editingSetId = ref(null);
const knowledgePoints = ref([]), selectedKnowledgePoint = ref(''), questionSearch = ref(''), questionType = ref(''), questionDifficulty = ref(''), questionSubject = ref(''), editingKnowledgeQuestion = ref(null), newKnowledgeName = ref('');
const expandedKnowledge = ref(new Set());
const libraryEditingQuestion = ref(null);
const questionViewMode = ref('list'), compareQuestionIndex = ref(0);
const pageSize = 10, paperPageSize = 9, paperPage = ref(1), taskPage = ref(1), questionPage = ref(1), paperSearch = ref(''), paperSubject = ref(''), taskSubject = ref(''), paperFilter = ref('all'), taskFilter = ref('all');
const paperViewMode = ref('list'), workspacePaperId = ref('');
const orderedSubjects = (values) => { const unique = [...new Set(values.map(value => value?.trim()).filter((value) => Boolean(value)))]; return ['数学', '物理', ...unique.filter(value => !['数学', '物理'].includes(value)).sort((a, b) => a.localeCompare(b, 'zh-CN'))]; };
const paperSubjects = computed(() => orderedSubjects(papers.value.map(p => p.subject)));
const questionSubjects = computed(() => orderedSubjects(confirmedQuestions.value.map(q => q.sourceSubject)));
const paperCounts = computed(() => ({ queued: papers.value.filter(p => p.status === 'queued').length, processing: papers.value.filter(p => ['processing', 'paused'].includes(p.status)).length, review: papers.value.filter(p => p.status === 'review').length }));
const filteredPapers = computed(() => papers.value.filter(p => (paperFilter.value === 'all' || p.status === paperFilter.value || (paperFilter.value === 'processing' && p.status === 'paused')) && (!paperSubject.value || p.subject === paperSubject.value) && (!paperSearch.value || `${p.title} ${p.grade} ${p.subject}`.toLowerCase().includes(paperSearch.value.toLowerCase()))));
const taskCounts = computed(() => ({ queued: papers.value.filter(p => p.status === 'queued').length, running: papers.value.filter(p => p.status === 'processing').length, paused: papers.value.filter(p => p.status === 'paused').length, failed: papers.value.filter(p => p.status === 'failed').length, completed: papers.value.filter(p => !['processing', 'queued', 'paused', 'failed'].includes(p.status)).length }));
const filteredTasks = computed(() => papers.value.filter(p => (!taskSubject.value || p.subject === taskSubject.value) && (taskFilter.value === 'all' || (taskFilter.value === 'queued' && p.status === 'queued') || (taskFilter.value === 'running' && ['processing', 'paused'].includes(p.status)) || (taskFilter.value === 'failed' && p.status === 'failed') || (taskFilter.value === 'completed' && !['processing', 'queued', 'paused', 'failed'].includes(p.status)))));
const subjectKnowledgePoints = computed(() => knowledgePoints.value.filter(item => !questionSubject.value || item.subject === questionSubject.value));
function knowledgeDescendants(id) { const ids = new Set([id]); let changed = true; while (changed) {
    changed = false;
    for (const point of subjectKnowledgePoints.value)
        if (point.parentId && ids.has(point.parentId) && !ids.has(point.id)) {
            ids.add(point.id);
            changed = true;
        }
} return ids; }
const filteredQuestions = computed(() => { const selected = selectedKnowledgePoint.value ? knowledgeDescendants(selectedKnowledgePoint.value) : null; return confirmedQuestions.value.filter(q => (!selected || q.knowledgePointIds?.some(id => selected.has(id))) && (!questionSubject.value || q.sourceSubject === questionSubject.value) && (!questionSearch.value || `${q.stem} ${q.sourceTitle || ''}`.toLowerCase().includes(questionSearch.value.toLowerCase())) && (!questionType.value || q.type === questionType.value) && (!questionDifficulty.value || q.difficulty === questionDifficulty.value)); });
const subjectQuestionCount = computed(() => confirmedQuestions.value.filter(q => !questionSubject.value || q.sourceSubject === questionSubject.value).length);
const pageCount = (total, size = pageSize) => Math.max(1, Math.ceil(total / size));
const pageItems = (items, currentPage, size = pageSize) => items.slice((currentPage - 1) * size, currentPage * size);
const paperPageCount = computed(() => pageCount(filteredPapers.value.length, paperPageSize)), taskPageCount = computed(() => pageCount(filteredTasks.value.length)), questionPageCount = computed(() => pageCount(filteredQuestions.value.length));
const pagedPapers = computed(() => pageItems(filteredPapers.value, paperPage.value, paperPageSize)), pagedTasks = computed(() => pageItems(filteredTasks.value, taskPage.value)), pagedQuestions = computed(() => pageItems(filteredQuestions.value, questionPage.value));
const visiblePages = (currentPage, totalPages) => Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4)) + index);
const rootKnowledgePoints = computed(() => subjectKnowledgePoints.value.filter(item => !item.parentId));
const knowledgeChildren = (parentId) => subjectKnowledgePoints.value.filter(item => item.parentId === parentId);
const visibleKnowledgePoints = computed(() => { const rows = []; const append = (point, depth) => { const children = knowledgeChildren(point.id); rows.push({ point, depth, hasChildren: children.length > 0 }); if (expandedKnowledge.value.has(point.id))
    children.forEach(child => append(child, depth + 1)); }; rootKnowledgePoints.value.forEach(root => append(root, 0)); return rows; });
function toggleKnowledge(id) { const next = new Set(expandedKnowledge.value); next.has(id) ? next.delete(id) : next.add(id); expandedKnowledge.value = next; }
const knowledgeName = (id) => knowledgePoints.value.find(item => item.id === id)?.name || '';
const stats = computed(() => ({ total: papers.value.length, parsing: papers.value.filter(p => ['queued', 'processing', 'paused'].includes(p.status)).length, reviewing: papers.value.filter(p => p.status === 'review').length, done: papers.value.reduce((n, p) => n + p.reviewedCount, 0), published: sets.value.filter(s => s.status === 'published').length }));
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
    return; await run(async () => { const parent = knowledgePoints.value.find(item => item.id === selectedKnowledgePoint.value); const subjectQuestion = confirmedQuestions.value.find(item => !questionSubject.value || item.sourceSubject === questionSubject.value); await api.createKnowledgePoint({ name, subject: parent?.subject || questionSubject.value || subjectQuestion?.sourceSubject || '数学', grade: parent?.grade || subjectQuestion?.sourceGrade || '', parentId: parent?.id }); newKnowledgeName.value = ''; knowledgePoints.value = await api.knowledgePoints(); notify('知识点已创建'); }); }
async function openPaper(p) { selectedPaper.value = p; page.value = 'review'; processingDetail.value = null; regionEditing.value = false; if (['processing', 'queued', 'paused'].includes(p.status)) {
    questions.value = [];
    processingDetail.value = await api.processing(p.id);
    return;
} await run(async () => { questions.value = await api.questions(p.id); selectedQuestion.value = questions.value[0] || null; }); }
async function locateQuestionInPaper(q) { const paper = papers.value.find(item => item.id === q.paperId); if (!paper) {
    notify('对应试卷不存在或已被删除');
    return;
} selectedPaper.value = paper; processingDetail.value = null; regionEditing.value = false; await run(async () => { const latest = await api.questions(paper.id); const target = latest.find(item => item.id === q.id); if (!target)
    throw new Error('该题已不在对应试卷中'); questions.value = latest; selectedQuestion.value = { ...target }; page.value = 'review'; }); }
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
async function toggleTaskPause(p) { await run(async () => { p.status === 'paused' ? await api.resume(p.id) : await api.pause(p.id); await load(); notify(p.status === 'paused' ? '任务已继续运行' : '任务已暂停'); }); }
async function deletePaper(p) { if (!window.confirm(`确定删除“${p.title}”吗？该试卷及其所属试题将从工作台中移除。`))
    return; await run(async () => { await api.deletePaper(p.id); await load(); notify('试卷及所属试题已删除'); }); }
function selectUploadFiles(event) { const input = event.target, next = Array.from(input.files || []), size = next.reduce((total, file) => total + file.size, 0); uploadError.value = ''; if (next.some(file => file.size > MAX_UPLOAD_BYTES) || size > MAX_UPLOAD_BYTES) {
    files.value = [];
    input.value = '';
    uploadError.value = '单个文件及本次上传总大小均不能超过 100MB';
    return;
} files.value = next; }
async function submitUpload() { if (!files.value.length)
    return uploadError.value = '请选择 PDF、图片或 ZIP'; if (uploadSize.value > MAX_UPLOAD_BYTES)
    return uploadError.value = '本次上传总大小不能超过 100MB'; uploadError.value = ''; await run(async () => { const result = await api.upload(files.value, upload.value); const uploaded = Array.isArray(result) ? result : [result]; uploadOpen.value = false; files.value = []; await load(); notify(uploaded.length > 1 ? `已创建 ${uploaded.length} 个解析任务` : '上传成功，AI 已开始解析'); await openPaper(uploaded[0]); }); }
async function saveQuestion() { if (!selectedQuestion.value)
    return; await run(async () => { selectedQuestion.value = await api.saveQuestion({ ...selectedQuestion.value, status: 'confirmed' }); const i = questions.value.findIndex(q => q.id === selectedQuestion.value.id); questions.value[i] = selectedQuestion.value; notify('校对结果已保存'); await load(); }); }
async function saveLibraryAnswer(question) { await run(async () => { const saved = await api.saveQuestion({ ...question, status: 'confirmed' }), merged = { ...question, ...saved }; const index = confirmedQuestions.value.findIndex(item => item.id === saved.id); if (index >= 0)
    confirmedQuestions.value[index] = merged; libraryEditingQuestion.value = { ...merged }; notify('答案与解析已保存'); }); }
async function saveLayout(layout) { if (!selectedQuestion.value)
    return; selectedQuestion.value = { ...selectedQuestion.value, presentationLayout: layout }; await saveQuestion(); layoutOpen.value = false; }
function updateQuestionFromLayout(question, message) { selectedQuestion.value = { ...question }; const index = questions.value.findIndex(item => item.id === question.id); if (index >= 0)
    questions.value[index] = { ...question }; notify(message); }
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
function openTeacherStore() { const url = new URL(import.meta.env.VITE_TEACHER_APP_URL || 'http://ai.hazer.top/teacher/', window.location.origin); url.searchParams.set('page', 'question-sets'); url.searchParams.set('tab', 'store'); window.open(url.toString(), '_blank', 'noopener,noreferrer'); }
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
watch([paperSearch, paperFilter, paperSubject], () => paperPage.value = 1);
watch(filteredPapers, items => { if (!items.some(item => item.id === workspacePaperId.value))
    workspacePaperId.value = items[0]?.id || ''; }, { immediate: true });
watch([taskFilter, taskSubject], () => taskPage.value = 1);
watch([selectedKnowledgePoint, questionSearch, questionType, questionDifficulty, questionSubject], () => questionPage.value = 1);
watch(questionSubject, () => { selectedKnowledgePoint.value = ''; expandedKnowledge.value = new Set(); });
watch(paperPageCount, total => paperPage.value = Math.min(paperPage.value, total));
watch(taskPageCount, total => taskPage.value = Math.min(taskPage.value, total));
watch(questionPageCount, total => questionPage.value = Math.min(questionPage.value, total));
watch(filteredQuestions, items => compareQuestionIndex.value = Math.min(compareQuestionIndex.value, Math.max(0, items.length - 1)));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['question-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['answer-edit']} */ ;
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
        if (__VLS_ctx.taskCounts.paused) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.taskCounts.paused);
        }
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
                    [page, taskCounts, taskCounts, taskCounts, taskFilter,];
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
                    return (__VLS_ctx.taskFilter = 'queued');
                    // @ts-ignore
                    [taskFilter, taskFilter, papers,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'queued' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.taskCounts.queued);
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
                    [taskCounts, taskFilter, taskFilter,];
                } },
            ...{ class: ({ active: __VLS_ctx.taskFilter === 'running' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.taskCounts.running + __VLS_ctx.taskCounts.paused);
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
                    [taskCounts, taskCounts, taskFilter, taskFilter,];
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
            ...{ class: "subject-filter-strip" },
        });
        /** @type {__VLS_StyleScopedClasses['subject-filter-strip']} */ ;
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
                    return (__VLS_ctx.taskSubject = '');
                    // @ts-ignore
                    [taskCounts, taskFilter, taskSubject,];
                } },
            ...{ class: ({ active: !__VLS_ctx.taskSubject }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        for (const [subject] of __VLS_vFor((__VLS_ctx.paperSubjects))) {
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
                        return (__VLS_ctx.taskSubject = subject);
                        // @ts-ignore
                        [taskSubject, taskSubject, paperSubjects,];
                    } },
                key: (subject),
                ...{ class: ({ active: __VLS_ctx.taskSubject === subject }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (subject);
            // @ts-ignore
            [taskSubject,];
        }
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
            (p.status === 'queued' ? '排队等待' : p.status === 'processing' ? '试卷解析' : p.status === 'paused' ? '已暂停' : p.status === 'failed' ? '解析失败' : '内容整理');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-main" },
            });
            /** @type {__VLS_StyleScopedClasses['task-main']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (p.status === 'queued' ? '排队解析：' : p.status === 'processing' ? '解析试卷：' : p.status === 'paused' ? '暂停解析：' : p.status === 'failed' ? '解析失败：' : '整理完成：');
            (p.title);
            if (p.status === 'queued') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
            }
            else if (p.status === 'processing') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
                (p.progress);
            }
            else if (p.status === 'paused') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
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
            (p.status === 'queued' ? '排队中' : p.status === 'processing' ? '处理中' : p.status === 'paused' ? '已暂停' : p.status === 'failed' ? '失败' : '已完成');
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
                            [pagedTasks, retryTask,];
                        } },
                    ...{ class: "primary" },
                    disabled: (__VLS_ctx.busy),
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
            }
            else if (p.status === 'queued') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ class: "ghost" },
                    disabled: true,
                });
                /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
            }
            else if (p.status === 'processing' || p.status === 'paused') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "task-actions" },
                });
                /** @type {__VLS_StyleScopedClasses['task-actions']} */ ;
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
                            if (!!(p.status === 'queued'))
                                throw 0;
                            if (!(p.status === 'processing' || p.status === 'paused'))
                                throw 0;
                            return (__VLS_ctx.toggleTaskPause(p));
                            // @ts-ignore
                            [busy, toggleTaskPause,];
                        } },
                    ...{ class: "ghost icon-command" },
                    title: (p.status === 'paused' ? '继续任务' : '暂停任务'),
                    disabled: (__VLS_ctx.busy),
                });
                /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['icon-command']} */ ;
                if (p.status === 'paused') {
                    let __VLS_100;
                    /** @ts-ignore @type { | typeof __VLS_components.Play} */
                    Play;
                    // @ts-ignore
                    const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({}));
                    const __VLS_102 = __VLS_101({}, ...__VLS_functionalComponentArgsRest(__VLS_101));
                }
                else {
                    let __VLS_105;
                    /** @ts-ignore @type { | typeof __VLS_components.Pause} */
                    Pause;
                    // @ts-ignore
                    const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({}));
                    const __VLS_107 = __VLS_106({}, ...__VLS_functionalComponentArgsRest(__VLS_106));
                }
                (p.status === 'paused' ? '继续' : '暂停');
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
                            if (!!(p.status === 'queued'))
                                throw 0;
                            if (!(p.status === 'processing' || p.status === 'paused'))
                                throw 0;
                            return (__VLS_ctx.openPaper(p));
                            // @ts-ignore
                            [busy, openPaper,];
                        } },
                    ...{ class: "ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
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
                            if (!!(p.status === 'queued'))
                                throw 0;
                            if (!!(p.status === 'processing' || p.status === 'paused'))
                                throw 0;
                            return (__VLS_ctx.openPaper(p));
                            // @ts-ignore
                            [openPaper,];
                        } },
                    ...{ class: "ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
            }
            // @ts-ignore
            [];
        }
        if (!__VLS_ctx.filteredTasks.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['task-empty']} */ ;
            let __VLS_110;
            /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
            RefreshCw;
            // @ts-ignore
            const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({}));
            const __VLS_112 = __VLS_111({}, ...__VLS_functionalComponentArgsRest(__VLS_111));
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
                let __VLS_115;
                /** @ts-ignore @type { | typeof __VLS_components.Plus} */
                Plus;
                // @ts-ignore
                const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({}));
                const __VLS_117 = __VLS_116({}, ...__VLS_functionalComponentArgsRest(__VLS_116));
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
            let __VLS_120;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
            ChevronLeft;
            // @ts-ignore
            const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({}));
            const __VLS_122 = __VLS_121({}, ...__VLS_functionalComponentArgsRest(__VLS_121));
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
            let __VLS_125;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({}));
            const __VLS_127 = __VLS_126({}, ...__VLS_functionalComponentArgsRest(__VLS_126));
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
        let __VLS_130;
        /** @ts-ignore @type { | typeof __VLS_components.Search} */
        Search;
        // @ts-ignore
        const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({}));
        const __VLS_132 = __VLS_131({}, ...__VLS_functionalComponentArgsRest(__VLS_131));
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
                    return (__VLS_ctx.paperFilter = 'queued');
                    // @ts-ignore
                    [papers, paperFilter, paperFilter,];
                } },
            ...{ class: "filter" },
            ...{ class: ({ active: __VLS_ctx.paperFilter === 'queued' }) },
        });
        /** @type {__VLS_StyleScopedClasses['filter']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (__VLS_ctx.paperCounts.queued);
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
                    return (__VLS_ctx.paperFilter = 'processing');
                    // @ts-ignore
                    [paperFilter, paperFilter, paperCounts,];
                } },
            ...{ class: "filter" },
            ...{ class: ({ active: __VLS_ctx.paperFilter === 'processing' }) },
        });
        /** @type {__VLS_StyleScopedClasses['filter']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (__VLS_ctx.paperCounts.processing);
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
                    [paperFilter, paperFilter, paperCounts,];
                } },
            ...{ class: "filter" },
            ...{ class: ({ active: __VLS_ctx.paperFilter === 'review' }) },
        });
        /** @type {__VLS_StyleScopedClasses['filter']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (__VLS_ctx.paperCounts.review);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "question-view-switch paper-view-switch" },
        });
        /** @type {__VLS_StyleScopedClasses['question-view-switch']} */ ;
        /** @type {__VLS_StyleScopedClasses['paper-view-switch']} */ ;
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
                    return (__VLS_ctx.paperViewMode = 'list');
                    // @ts-ignore
                    [paperFilter, paperCounts, paperViewMode,];
                } },
            ...{ class: ({ active: __VLS_ctx.paperViewMode === 'list' }) },
            title: "列表模式",
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        let __VLS_135;
        /** @ts-ignore @type { | typeof __VLS_components.List} */
        List;
        // @ts-ignore
        const __VLS_136 = __VLS_asFunctionalComponent1(__VLS_135, new __VLS_135({}));
        const __VLS_137 = __VLS_136({}, ...__VLS_functionalComponentArgsRest(__VLS_136));
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
                    return (__VLS_ctx.paperViewMode = 'workspace');
                    // @ts-ignore
                    [paperViewMode, paperViewMode,];
                } },
            ...{ class: ({ active: __VLS_ctx.paperViewMode === 'workspace' }) },
            title: "工作台模式",
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        let __VLS_140;
        /** @ts-ignore @type { | typeof __VLS_components.PanelsTopLeft} */
        PanelsTopLeft;
        // @ts-ignore
        const __VLS_141 = __VLS_asFunctionalComponent1(__VLS_140, new __VLS_140({}));
        const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "subject-filter-strip paper-subject-filter" },
        });
        /** @type {__VLS_StyleScopedClasses['subject-filter-strip']} */ ;
        /** @type {__VLS_StyleScopedClasses['paper-subject-filter']} */ ;
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
                    return (__VLS_ctx.paperSubject = '');
                    // @ts-ignore
                    [paperViewMode, paperSubject,];
                } },
            ...{ class: ({ active: !__VLS_ctx.paperSubject }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        for (const [subject] of __VLS_vFor((__VLS_ctx.paperSubjects))) {
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
                        return (__VLS_ctx.paperSubject = subject);
                        // @ts-ignore
                        [paperSubjects, paperSubject, paperSubject,];
                    } },
                key: (subject),
                ...{ class: ({ active: __VLS_ctx.paperSubject === subject }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (subject);
            // @ts-ignore
            [paperSubject,];
        }
        if (__VLS_ctx.paperViewMode === 'list') {
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
                            if (!(__VLS_ctx.paperViewMode === 'list'))
                                throw 0;
                            return (__VLS_ctx.openPaper(p));
                            // @ts-ignore
                            [openPaper, paperViewMode, pagedPapers,];
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
                (p.status === 'queued' ? '排队中' : p.status === 'processing' ? '解析中' : p.status === 'review' ? '待校对' : '可发行');
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
                            if (!(__VLS_ctx.paperViewMode === 'list'))
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
                let __VLS_145;
                /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
                Trash2;
                // @ts-ignore
                const __VLS_146 = __VLS_asFunctionalComponent1(__VLS_145, new __VLS_145({}));
                const __VLS_147 = __VLS_146({}, ...__VLS_functionalComponentArgsRest(__VLS_146));
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
                (p.status === 'queued' ? '等待解析' : p.status === 'processing' ? '查看解析进度' : p.status === 'ready' ? '查看已校对试题' : '进入校对');
                let __VLS_150;
                /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
                ChevronRight;
                // @ts-ignore
                const __VLS_151 = __VLS_asFunctionalComponent1(__VLS_150, new __VLS_150({}));
                const __VLS_152 = __VLS_151({}, ...__VLS_functionalComponentArgsRest(__VLS_151));
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
                            if (!(__VLS_ctx.paperViewMode === 'list'))
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
                let __VLS_155;
                /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
                ChevronLeft;
                // @ts-ignore
                const __VLS_156 = __VLS_asFunctionalComponent1(__VLS_155, new __VLS_155({}));
                const __VLS_157 = __VLS_156({}, ...__VLS_functionalComponentArgsRest(__VLS_156));
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
                                if (!(__VLS_ctx.paperViewMode === 'list'))
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
                            if (!(__VLS_ctx.paperViewMode === 'list'))
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
                let __VLS_160;
                /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
                ChevronRight;
                // @ts-ignore
                const __VLS_161 = __VLS_asFunctionalComponent1(__VLS_160, new __VLS_160({}));
                const __VLS_162 = __VLS_161({}, ...__VLS_functionalComponentArgsRest(__VLS_161));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.filteredPapers.length);
            }
        }
        else {
            const __VLS_165 = PaperWorkspaceView;
            // @ts-ignore
            const __VLS_166 = __VLS_asFunctionalComponent1(__VLS_165, new __VLS_165({
                ...{ 'onSelect': {} },
                ...{ 'onOpen': {} },
                ...{ 'onRetry': {} },
                ...{ 'onDelete': {} },
                papers: (__VLS_ctx.filteredPapers),
                selectedId: (__VLS_ctx.workspacePaperId),
                busy: (__VLS_ctx.busy),
            }));
            const __VLS_167 = __VLS_166({
                ...{ 'onSelect': {} },
                ...{ 'onOpen': {} },
                ...{ 'onRetry': {} },
                ...{ 'onDelete': {} },
                papers: (__VLS_ctx.filteredPapers),
                selectedId: (__VLS_ctx.workspacePaperId),
                busy: (__VLS_ctx.busy),
            }, ...__VLS_functionalComponentArgsRest(__VLS_166));
            let __VLS_170;
            const __VLS_171 = {
                /** @type {typeof __VLS_170.select} */
                onSelect: (...[$event]) => {
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
                    if (!!(__VLS_ctx.paperViewMode === 'list'))
                        throw 0;
                    return (__VLS_ctx.workspacePaperId = $event.id);
                    // @ts-ignore
                    [busy, filteredPapers, filteredPapers, paperPage, paperPageCount, workspacePaperId, workspacePaperId,];
                },
            };
            const __VLS_172 = {
                /** @type {typeof __VLS_170.open} */
                onOpen: (__VLS_ctx.openPaper),
            };
            const __VLS_173 = {
                /** @type {typeof __VLS_170.retry} */
                onRetry: (__VLS_ctx.retryTask),
            };
            const __VLS_174 = {
                /** @type {typeof __VLS_170.delete} */
                onDelete: (__VLS_ctx.deletePaper),
            };
            var __VLS_168;
            var __VLS_169;
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
                    [page, page, retryTask, openPaper, deletePaper,];
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
        let __VLS_175;
        /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
        RefreshCw;
        // @ts-ignore
        const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({}));
        const __VLS_177 = __VLS_176({}, ...__VLS_functionalComponentArgsRest(__VLS_176));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.reparsePaper) },
            ...{ class: "reparse-button" },
            disabled: (__VLS_ctx.busy || ['processing', 'queued', 'paused'].includes(__VLS_ctx.selectedPaper?.status || '')),
        });
        /** @type {__VLS_StyleScopedClasses['reparse-button']} */ ;
        let __VLS_180;
        /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
        WandSparkles;
        // @ts-ignore
        const __VLS_181 = __VLS_asFunctionalComponent1(__VLS_180, new __VLS_180({}));
        const __VLS_182 = __VLS_181({}, ...__VLS_functionalComponentArgsRest(__VLS_181));
        (__VLS_ctx.busy ? '提交中' : '重新解析');
        if (__VLS_ctx.selectedPaper && ['processing', 'queued', 'paused'].includes(__VLS_ctx.selectedPaper.status)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "processing" },
            });
            /** @type {__VLS_StyleScopedClasses['processing']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "ai-orb" },
            });
            /** @type {__VLS_StyleScopedClasses['ai-orb']} */ ;
            let __VLS_185;
            /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
            WandSparkles;
            // @ts-ignore
            const __VLS_186 = __VLS_asFunctionalComponent1(__VLS_185, new __VLS_185({}));
            const __VLS_187 = __VLS_186({}, ...__VLS_functionalComponentArgsRest(__VLS_186));
            __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
            (__VLS_ctx.selectedPaper.status === 'queued' ? '任务正在排队等待' : __VLS_ctx.selectedPaper.status === 'paused' ? '解析任务已暂停' : 'AI 正在识别并拆分试题');
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            (__VLS_ctx.selectedPaper.status === 'queued' ? '当前并发解析名额已满，任务开始后会自动更新进度。' : __VLS_ctx.selectedPaper.status === 'paused' ? '继续任务后将从当前解析节点恢复。' : `当前进度 ${__VLS_ctx.selectedPaper.progress}%，解析完成后即可逐题校对。`);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "big-meter" },
            });
            /** @type {__VLS_StyleScopedClasses['big-meter']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
                ...{ style: ({ width: __VLS_ctx.selectedPaper.progress + '%' }) },
            });
            if (__VLS_ctx.selectedPaper.status === 'paused') {
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
                            if (!(__VLS_ctx.selectedPaper && ['processing', 'queued', 'paused'].includes(__VLS_ctx.selectedPaper.status)))
                                throw 0;
                            if (!(__VLS_ctx.selectedPaper.status === 'paused'))
                                throw 0;
                            return (__VLS_ctx.toggleTaskPause(__VLS_ctx.selectedPaper));
                            // @ts-ignore
                            [busy, busy, busy, toggleTaskPause, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, selectedPaper, refreshPaper, reparsePaper,];
                        } },
                    ...{ class: "primary" },
                    disabled: (__VLS_ctx.busy),
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                let __VLS_190;
                /** @ts-ignore @type { | typeof __VLS_components.Play} */
                Play;
                // @ts-ignore
                const __VLS_191 = __VLS_asFunctionalComponent1(__VLS_190, new __VLS_190({}));
                const __VLS_192 = __VLS_191({}, ...__VLS_functionalComponentArgsRest(__VLS_191));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.refreshPaper) },
                    ...{ class: "primary" },
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
            }
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
                            if (!!(__VLS_ctx.selectedPaper && ['processing', 'queued', 'paused'].includes(__VLS_ctx.selectedPaper.status)))
                                throw 0;
                            return (__VLS_ctx.selectedQuestion = { ...q });
                            // @ts-ignore
                            [busy, refreshPaper, questions, questions, selectedQuestion,];
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
                const __VLS_195 = MathPreview;
                // @ts-ignore
                const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
                    ...{ class: "question-nav-preview" },
                    text: (q.stem),
                }));
                const __VLS_197 = __VLS_196({
                    ...{ class: "question-nav-preview" },
                    text: (q.stem),
                }, ...__VLS_functionalComponentArgsRest(__VLS_196));
                /** @type {__VLS_StyleScopedClasses['question-nav-preview']} */ ;
                if (q.status === 'confirmed') {
                    let __VLS_200;
                    /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
                    CheckCircle2;
                    // @ts-ignore
                    const __VLS_201 = __VLS_asFunctionalComponent1(__VLS_200, new __VLS_200({}));
                    const __VLS_202 = __VLS_201({}, ...__VLS_functionalComponentArgsRest(__VLS_201));
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
            let __VLS_205;
            /** @ts-ignore @type { | typeof __VLS_components.Archive} */
            Archive;
            // @ts-ignore
            const __VLS_206 = __VLS_asFunctionalComponent1(__VLS_205, new __VLS_205({}));
            const __VLS_207 = __VLS_206({}, ...__VLS_functionalComponentArgsRest(__VLS_206));
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
                let __VLS_210;
                /** @ts-ignore @type { | typeof __VLS_components.WandSparkles} */
                WandSparkles;
                // @ts-ignore
                const __VLS_211 = __VLS_asFunctionalComponent1(__VLS_210, new __VLS_210({}));
                const __VLS_212 = __VLS_211({}, ...__VLS_functionalComponentArgsRest(__VLS_211));
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
                const __VLS_215 = MathPreview;
                // @ts-ignore
                const __VLS_216 = __VLS_asFunctionalComponent1(__VLS_215, new __VLS_215({
                    text: (__VLS_ctx.selectedQuestion.stem),
                }));
                const __VLS_217 = __VLS_216({
                    text: (__VLS_ctx.selectedQuestion.stem),
                }, ...__VLS_functionalComponentArgsRest(__VLS_216));
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
                        const __VLS_220 = MathPreview;
                        // @ts-ignore
                        const __VLS_221 = __VLS_asFunctionalComponent1(__VLS_220, new __VLS_220({
                            text: (__VLS_ctx.optionText(option, index)),
                        }));
                        const __VLS_222 = __VLS_221({
                            text: (__VLS_ctx.optionText(option, index)),
                        }, ...__VLS_functionalComponentArgsRest(__VLS_221));
                        // @ts-ignore
                        [selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, optionText,];
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
                const __VLS_225 = MathPreview;
                // @ts-ignore
                const __VLS_226 = __VLS_asFunctionalComponent1(__VLS_225, new __VLS_225({
                    text: (__VLS_ctx.selectedQuestion.answer),
                }));
                const __VLS_227 = __VLS_226({
                    text: (__VLS_ctx.selectedQuestion.answer),
                }, ...__VLS_functionalComponentArgsRest(__VLS_226));
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
                    const __VLS_230 = MathPreview;
                    // @ts-ignore
                    const __VLS_231 = __VLS_asFunctionalComponent1(__VLS_230, new __VLS_230({
                        text: (__VLS_ctx.selectedQuestion.analysis),
                    }));
                    const __VLS_232 = __VLS_231({
                        text: (__VLS_ctx.selectedQuestion.analysis),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_231));
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
                let __VLS_235;
                /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
                CheckCircle2;
                // @ts-ignore
                const __VLS_236 = __VLS_asFunctionalComponent1(__VLS_235, new __VLS_235({}));
                const __VLS_237 = __VLS_236({}, ...__VLS_functionalComponentArgsRest(__VLS_236));
            }
        }
    }
    else if (__VLS_ctx.page === 'questions') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "question-library" },
            ...{ style: ({ gridTemplateColumns: __VLS_ctx.libraryEditingQuestion ? '280px minmax(560px,1fr) 360px' : '280px 1fr' }) },
        });
        /** @type {__VLS_StyleScopedClasses['question-library']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "knowledge-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "subject-filter-strip knowledge-subject-filter" },
        });
        /** @type {__VLS_StyleScopedClasses['subject-filter-strip']} */ ;
        /** @type {__VLS_StyleScopedClasses['knowledge-subject-filter']} */ ;
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
                    return (__VLS_ctx.questionSubject = '');
                    // @ts-ignore
                    [page, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, saveQuestion, libraryEditingQuestion, questionSubject,];
                } },
            ...{ class: ({ active: !__VLS_ctx.questionSubject }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        for (const [subject] of __VLS_vFor((__VLS_ctx.questionSubjects))) {
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
                        return (__VLS_ctx.questionSubject = subject);
                        // @ts-ignore
                        [questionSubject, questionSubject, questionSubjects,];
                    } },
                key: (subject),
                ...{ class: ({ active: __VLS_ctx.questionSubject === subject }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (subject);
            // @ts-ignore
            [questionSubject,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "knowledge-title" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        let __VLS_240;
        /** @ts-ignore @type { | typeof __VLS_components.Tags} */
        Tags;
        // @ts-ignore
        const __VLS_241 = __VLS_asFunctionalComponent1(__VLS_240, new __VLS_240({}));
        const __VLS_242 = __VLS_241({}, ...__VLS_functionalComponentArgsRest(__VLS_241));
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.subjectKnowledgePoints.length);
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
                    [subjectKnowledgePoints, selectedKnowledgePoint,];
                } },
            ...{ class: "knowledge-all" },
            ...{ class: ({ active: !__VLS_ctx.selectedKnowledgePoint }) },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.subjectQuestionCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "knowledge-tree" },
        });
        /** @type {__VLS_StyleScopedClasses['knowledge-tree']} */ ;
        for (const [row] of __VLS_vFor((__VLS_ctx.visibleKnowledgePoints))) {
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
                        return (__VLS_ctx.selectedKnowledgePoint = row.point.id);
                        // @ts-ignore
                        [selectedKnowledgePoint, selectedKnowledgePoint, subjectQuestionCount, visibleKnowledgePoints,];
                    } },
                key: (row.point.id),
                ...{ class: "knowledge-node" },
                ...{ class: ({ active: __VLS_ctx.selectedKnowledgePoint === row.point.id }) },
                ...{ style: ({ paddingLeft: `${10 + row.depth * 18}px` }) },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-node']} */ ;
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
                        return (row.hasChildren && __VLS_ctx.toggleKnowledge(row.point.id));
                        // @ts-ignore
                        [selectedKnowledgePoint, toggleKnowledge,];
                    } },
                ...{ class: "knowledge-toggle" },
                ...{ class: ({ expanded: __VLS_ctx.expandedKnowledge.has(row.point.id), hidden: !row.hasChildren }) },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-toggle']} */ ;
            /** @type {__VLS_StyleScopedClasses['expanded']} */ ;
            /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
            let __VLS_245;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_246 = __VLS_asFunctionalComponent1(__VLS_245, new __VLS_245({}));
            const __VLS_247 = __VLS_246({}, ...__VLS_functionalComponentArgsRest(__VLS_246));
            (row.point.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (row.point.questionCount);
            // @ts-ignore
            [expandedKnowledge,];
        }
        if (!__VLS_ctx.subjectKnowledgePoints.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "knowledge-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['knowledge-empty']} */ ;
            let __VLS_250;
            /** @ts-ignore @type { | typeof __VLS_components.Tags} */
            Tags;
            // @ts-ignore
            const __VLS_251 = __VLS_asFunctionalComponent1(__VLS_250, new __VLS_250({}));
            const __VLS_252 = __VLS_251({}, ...__VLS_functionalComponentArgsRest(__VLS_251));
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
        let __VLS_255;
        /** @ts-ignore @type { | typeof __VLS_components.Search} */
        Search;
        // @ts-ignore
        const __VLS_256 = __VLS_asFunctionalComponent1(__VLS_255, new __VLS_255({}));
        const __VLS_257 = __VLS_256({}, ...__VLS_functionalComponentArgsRest(__VLS_256));
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "question-view-switch" },
        });
        /** @type {__VLS_StyleScopedClasses['question-view-switch']} */ ;
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
                    return (__VLS_ctx.questionViewMode = 'list');
                    // @ts-ignore
                    [busy, subjectKnowledgePoints, selectedKnowledgePoint, createKnowledgePoint, newKnowledgeName, newKnowledgeName, questionSearch, questionType, questionDifficulty, questionViewMode,];
                } },
            ...{ class: ({ active: __VLS_ctx.questionViewMode === 'list' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
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
                    return (__VLS_ctx.questionViewMode = 'compare');
                    // @ts-ignore
                    [questionViewMode, questionViewMode,];
                } },
            ...{ class: ({ active: __VLS_ctx.questionViewMode === 'compare' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.filteredQuestions.length);
        if (__VLS_ctx.questionViewMode === 'list') {
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
                            if (!(__VLS_ctx.questionViewMode === 'list'))
                                throw 0;
                            return (__VLS_ctx.libraryEditingQuestion = { ...q });
                            // @ts-ignore
                            [libraryEditingQuestion, questionViewMode, questionViewMode, filteredQuestions, pagedQuestions,];
                        } },
                    ...{ class: "answer-edit" },
                    ...{ class: ({ active: __VLS_ctx.libraryEditingQuestion?.id === q.id }) },
                    title: "编辑正确答案和解析",
                });
                /** @type {__VLS_StyleScopedClasses['answer-edit']} */ ;
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                let __VLS_260;
                /** @ts-ignore @type { | typeof __VLS_components.FilePenLine} */
                FilePenLine;
                // @ts-ignore
                const __VLS_261 = __VLS_asFunctionalComponent1(__VLS_260, new __VLS_260({}));
                const __VLS_262 = __VLS_261({}, ...__VLS_functionalComponentArgsRest(__VLS_261));
                (__VLS_ctx.libraryEditingQuestion?.id === q.id ? '正在编辑' : '编辑答案解析');
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
                            if (!(__VLS_ctx.questionViewMode === 'list'))
                                throw 0;
                            return (__VLS_ctx.locateQuestionInPaper(q));
                            // @ts-ignore
                            [libraryEditingQuestion, libraryEditingQuestion, locateQuestionInPaper,];
                        } },
                    ...{ class: "source-locate" },
                    ...{ style: {} },
                    title: "在原卷中定位",
                });
                /** @type {__VLS_StyleScopedClasses['source-locate']} */ ;
                let __VLS_265;
                /** @ts-ignore @type { | typeof __VLS_components.LocateFixed} */
                LocateFixed;
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
                            if (!(__VLS_ctx.page === 'questions'))
                                throw 0;
                            if (!(__VLS_ctx.questionViewMode === 'list'))
                                throw 0;
                            return (__VLS_ctx.editingKnowledgeQuestion = __VLS_ctx.editingKnowledgeQuestion === q.id ? null : q.id);
                            // @ts-ignore
                            [editingKnowledgeQuestion, editingKnowledgeQuestion,];
                        } },
                    ...{ style: {} },
                });
                let __VLS_270;
                /** @ts-ignore @type { | typeof __VLS_components.Tags} */
                Tags;
                // @ts-ignore
                const __VLS_271 = __VLS_asFunctionalComponent1(__VLS_270, new __VLS_270({}));
                const __VLS_272 = __VLS_271({}, ...__VLS_functionalComponentArgsRest(__VLS_271));
                const __VLS_275 = QuestionFinalPreview;
                // @ts-ignore
                const __VLS_276 = __VLS_asFunctionalComponent1(__VLS_275, new __VLS_275({
                    question: (q),
                }));
                const __VLS_277 = __VLS_276({
                    question: (q),
                }, ...__VLS_functionalComponentArgsRest(__VLS_276));
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
                                    if (!(__VLS_ctx.questionViewMode === 'list'))
                                        throw 0;
                                    if (!(__VLS_ctx.editingKnowledgeQuestion === q.id))
                                        throw 0;
                                    return (__VLS_ctx.toggleQuestionKnowledge(q, point.id));
                                    // @ts-ignore
                                    [editingKnowledgeQuestion, knowledgePoints, toggleQuestionKnowledge,];
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
        }
        else {
            const __VLS_280 = QuestionCompareView;
            // @ts-ignore
            const __VLS_281 = __VLS_asFunctionalComponent1(__VLS_280, new __VLS_280({
                ...{ 'onChange': {} },
                questions: (__VLS_ctx.filteredQuestions),
                index: (__VLS_ctx.compareQuestionIndex),
            }));
            const __VLS_282 = __VLS_281({
                ...{ 'onChange': {} },
                questions: (__VLS_ctx.filteredQuestions),
                index: (__VLS_ctx.compareQuestionIndex),
            }, ...__VLS_functionalComponentArgsRest(__VLS_281));
            let __VLS_285;
            const __VLS_286 = {
                /** @type {typeof __VLS_285.change} */
                onChange: (...[$event]) => {
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
                    if (!!(__VLS_ctx.questionViewMode === 'list'))
                        throw 0;
                    return (__VLS_ctx.compareQuestionIndex = $event);
                    // @ts-ignore
                    [filteredQuestions, compareQuestionIndex, compareQuestionIndex,];
                },
            };
            var __VLS_283;
            var __VLS_284;
        }
        if (!__VLS_ctx.filteredQuestions.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "question-list-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['question-list-empty']} */ ;
            let __VLS_287;
            /** @ts-ignore @type { | typeof __VLS_components.Search} */
            Search;
            // @ts-ignore
            const __VLS_288 = __VLS_asFunctionalComponent1(__VLS_287, new __VLS_287({}));
            const __VLS_289 = __VLS_288({}, ...__VLS_functionalComponentArgsRest(__VLS_288));
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        if (__VLS_ctx.questionViewMode === 'list' && __VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize) {
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
                        if (!(__VLS_ctx.questionViewMode === 'list' && __VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.questionPage--);
                        // @ts-ignore
                        [pageSize, questionViewMode, filteredQuestions, filteredQuestions, questionPage,];
                    } },
                disabled: (__VLS_ctx.questionPage === 1),
                title: "上一页",
            });
            let __VLS_292;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
            ChevronLeft;
            // @ts-ignore
            const __VLS_293 = __VLS_asFunctionalComponent1(__VLS_292, new __VLS_292({}));
            const __VLS_294 = __VLS_293({}, ...__VLS_functionalComponentArgsRest(__VLS_293));
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
                            if (!(__VLS_ctx.questionViewMode === 'list' && __VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
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
                        if (!(__VLS_ctx.questionViewMode === 'list' && __VLS_ctx.filteredQuestions.length > __VLS_ctx.pageSize))
                            throw 0;
                        return (__VLS_ctx.questionPage++);
                        // @ts-ignore
                        [questionPage,];
                    } },
                disabled: (__VLS_ctx.questionPage === __VLS_ctx.questionPageCount),
                title: "下一页",
            });
            let __VLS_297;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
            ChevronRight;
            // @ts-ignore
            const __VLS_298 = __VLS_asFunctionalComponent1(__VLS_297, new __VLS_297({}));
            const __VLS_299 = __VLS_298({}, ...__VLS_functionalComponentArgsRest(__VLS_298));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.filteredQuestions.length);
        }
        if (__VLS_ctx.libraryEditingQuestion) {
            const __VLS_302 = QuestionAnswerEditor;
            // @ts-ignore
            const __VLS_303 = __VLS_asFunctionalComponent1(__VLS_302, new __VLS_302({
                ...{ 'onClose': {} },
                ...{ 'onSave': {} },
                question: (__VLS_ctx.libraryEditingQuestion),
                saving: (__VLS_ctx.busy),
            }));
            const __VLS_304 = __VLS_303({
                ...{ 'onClose': {} },
                ...{ 'onSave': {} },
                question: (__VLS_ctx.libraryEditingQuestion),
                saving: (__VLS_ctx.busy),
            }, ...__VLS_functionalComponentArgsRest(__VLS_303));
            let __VLS_307;
            const __VLS_308 = {
                /** @type {typeof __VLS_307.close} */
                onClose: (...[$event]) => {
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
                    if (!(__VLS_ctx.libraryEditingQuestion))
                        throw 0;
                    return (__VLS_ctx.libraryEditingQuestion = null);
                    // @ts-ignore
                    [busy, libraryEditingQuestion, libraryEditingQuestion, libraryEditingQuestion, filteredQuestions, questionPage, questionPageCount,];
                },
            };
            const __VLS_309 = {
                /** @type {typeof __VLS_307.save} */
                onSave: (__VLS_ctx.saveLibraryAnswer),
            };
            var __VLS_305;
            var __VLS_306;
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
                    [saveLibraryAnswer, setTab,];
                } },
            ...{ class: ({ active: __VLS_ctx.setTab === 'mine' }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        let __VLS_310;
        /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
        BookOpenCheck;
        // @ts-ignore
        const __VLS_311 = __VLS_asFunctionalComponent1(__VLS_310, new __VLS_310({}));
        const __VLS_312 = __VLS_311({}, ...__VLS_functionalComponentArgsRest(__VLS_311));
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
        let __VLS_315;
        /** @ts-ignore @type { | typeof __VLS_components.ShoppingBag} */
        ShoppingBag;
        // @ts-ignore
        const __VLS_316 = __VLS_asFunctionalComponent1(__VLS_315, new __VLS_315({}));
        const __VLS_317 = __VLS_316({}, ...__VLS_functionalComponentArgsRest(__VLS_316));
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
        let __VLS_320;
        /** @ts-ignore @type { | typeof __VLS_components.Plus} */
        Plus;
        // @ts-ignore
        const __VLS_321 = __VLS_asFunctionalComponent1(__VLS_320, new __VLS_320({}));
        const __VLS_322 = __VLS_321({}, ...__VLS_functionalComponentArgsRest(__VLS_321));
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
                let __VLS_325;
                /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
                BookOpenCheck;
                // @ts-ignore
                const __VLS_326 = __VLS_asFunctionalComponent1(__VLS_325, new __VLS_325({}));
                const __VLS_327 = __VLS_326({}, ...__VLS_functionalComponentArgsRest(__VLS_326));
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
                    let __VLS_330;
                    /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
                    Trash2;
                    // @ts-ignore
                    const __VLS_331 = __VLS_asFunctionalComponent1(__VLS_330, new __VLS_330({}));
                    const __VLS_332 = __VLS_331({}, ...__VLS_functionalComponentArgsRest(__VLS_331));
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
                let __VLS_335;
                /** @ts-ignore @type { | typeof __VLS_components.BookOpenCheck} */
                BookOpenCheck;
                // @ts-ignore
                const __VLS_336 = __VLS_asFunctionalComponent1(__VLS_335, new __VLS_335({}));
                const __VLS_337 = __VLS_336({}, ...__VLS_functionalComponentArgsRest(__VLS_336));
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
                let __VLS_340;
                /** @ts-ignore @type { | typeof __VLS_components.Plus} */
                Plus;
                // @ts-ignore
                const __VLS_341 = __VLS_asFunctionalComponent1(__VLS_340, new __VLS_340({}));
                const __VLS_342 = __VLS_341({}, ...__VLS_functionalComponentArgsRest(__VLS_341));
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sales-panel" },
            });
            /** @type {__VLS_StyleScopedClasses['sales-panel']} */ ;
            let __VLS_345;
            /** @ts-ignore @type { | typeof __VLS_components.ShoppingBag} */
            ShoppingBag;
            // @ts-ignore
            const __VLS_346 = __VLS_asFunctionalComponent1(__VLS_345, new __VLS_345({}));
            const __VLS_347 = __VLS_346({}, ...__VLS_functionalComponentArgsRest(__VLS_346));
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
        let __VLS_350;
        /** @ts-ignore @type { | typeof __VLS_components.UploadCloud} */
        UploadCloud;
        // @ts-ignore
        const __VLS_351 = __VLS_asFunctionalComponent1(__VLS_350, new __VLS_350({}));
        const __VLS_352 = __VLS_351({}, ...__VLS_functionalComponentArgsRest(__VLS_351));
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.selectUploadFiles) },
            type: "file",
            accept: "application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,.zip,application/zip,application/x-zip-compressed",
            multiple: true,
        });
        if (__VLS_ctx.files.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
            (__VLS_ctx.files.length);
            ((__VLS_ctx.uploadSize / 1024 / 1024).toFixed(1));
        }
        if (__VLS_ctx.uploadError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "error" },
            });
            /** @type {__VLS_StyleScopedClasses['error']} */ ;
            (__VLS_ctx.uploadError);
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
            disabled: (__VLS_ctx.busy || !!__VLS_ctx.uploadError),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
    }
    if (__VLS_ctx.page === 'assembly') {
        const __VLS_355 = QuestionSetAssembler;
        // @ts-ignore
        const __VLS_356 = __VLS_asFunctionalComponent1(__VLS_355, new __VLS_355({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            questions: (__VLS_ctx.confirmedQuestions),
            initial: (__VLS_ctx.setForm),
            editing: (!!__VLS_ctx.editingSetId),
            saving: (__VLS_ctx.busy),
        }));
        const __VLS_357 = __VLS_356({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            questions: (__VLS_ctx.confirmedQuestions),
            initial: (__VLS_ctx.setForm),
            editing: (!!__VLS_ctx.editingSetId),
            saving: (__VLS_ctx.busy),
        }, ...__VLS_functionalComponentArgsRest(__VLS_356));
        let __VLS_360;
        const __VLS_361 = {
            /** @type {typeof __VLS_360.close} */
            onClose: (__VLS_ctx.closeSetEditor),
        };
        const __VLS_362 = {
            /** @type {typeof __VLS_360.save} */
            onSave: (__VLS_ctx.saveSetForm),
        };
        var __VLS_358;
        var __VLS_359;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedQuestion?.boundaryQuality) {
        let __VLS_363;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_364 = __VLS_asFunctionalComponent1(__VLS_363, new __VLS_363({
            to: ".inspector",
        }));
        const __VLS_365 = __VLS_364({
            to: ".inspector",
        }, ...__VLS_functionalComponentArgsRest(__VLS_364));
        const { default: __VLS_368 } = __VLS_366.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "boundary-quality" },
            'data-review': (__VLS_ctx.selectedQuestion.boundaryQuality.requiresManualReview),
        });
        /** @type {__VLS_StyleScopedClasses['boundary-quality']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.selectedQuestion.boundaryQuality.requiresManualReview) {
            let __VLS_369;
            /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
            AlertTriangle;
            // @ts-ignore
            const __VLS_370 = __VLS_asFunctionalComponent1(__VLS_369, new __VLS_369({}));
            const __VLS_371 = __VLS_370({}, ...__VLS_functionalComponentArgsRest(__VLS_370));
        }
        else {
            let __VLS_374;
            /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
            CheckCircle2;
            // @ts-ignore
            const __VLS_375 = __VLS_asFunctionalComponent1(__VLS_374, new __VLS_374({}));
            const __VLS_376 = __VLS_375({}, ...__VLS_functionalComponentArgsRest(__VLS_375));
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
            [busy, busy, page, page, confirmedQuestions, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectedQuestion, selectUploadFiles, files, files, uploadSize, uploadError, uploadError, uploadError, upload, upload, upload, setForm, editingSetId, closeSetEditor, saveSetForm, warningLabel,];
        }
        // @ts-ignore
        [];
        var __VLS_366;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedQuestion) {
        let __VLS_379;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_380 = __VLS_asFunctionalComponent1(__VLS_379, new __VLS_379({
            to: ".review-actions",
        }));
        const __VLS_381 = __VLS_380({
            to: ".review-actions",
        }, ...__VLS_functionalComponentArgsRest(__VLS_380));
        const { default: __VLS_384 } = __VLS_382.slots;
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
            let __VLS_385;
            /** @ts-ignore @type { | typeof __VLS_components.Settings2} */
            Settings2;
            // @ts-ignore
            const __VLS_386 = __VLS_asFunctionalComponent1(__VLS_385, new __VLS_385({}));
            const __VLS_387 = __VLS_386({}, ...__VLS_functionalComponentArgsRest(__VLS_386));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveQuestion) },
            ...{ class: "primary save-question-top" },
            disabled: (__VLS_ctx.busy),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['save-question-top']} */ ;
        let __VLS_390;
        /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_391 = __VLS_asFunctionalComponent1(__VLS_390, new __VLS_390({}));
        const __VLS_392 = __VLS_391({}, ...__VLS_functionalComponentArgsRest(__VLS_391));
        (__VLS_ctx.busy ? '保存中' : '确认并保存题目');
        // @ts-ignore
        [busy, busy, saveQuestion,];
        var __VLS_382;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedPaper && ['processing', 'queued', 'paused'].includes(__VLS_ctx.selectedPaper.status) && __VLS_ctx.processingDetail) {
        let __VLS_395;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_396 = __VLS_asFunctionalComponent1(__VLS_395, new __VLS_395({
            to: ".processing",
        }));
        const __VLS_397 = __VLS_396({
            to: ".processing",
        }, ...__VLS_functionalComponentArgsRest(__VLS_396));
        const { default: __VLS_400 } = __VLS_398.slots;
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
            [page, selectedPaper, selectedPaper, processingDetail, processingDetail,];
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
        var __VLS_398;
    }
    if (__VLS_ctx.page === 'review' && __VLS_ctx.selectedPaper && __VLS_ctx.selectedQuestion) {
        let __VLS_401;
        /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_402 = __VLS_asFunctionalComponent1(__VLS_401, new __VLS_401({
            to: ".crop-placeholder",
        }));
        const __VLS_403 = __VLS_402({
            to: ".crop-placeholder",
        }, ...__VLS_functionalComponentArgsRest(__VLS_402));
        const { default: __VLS_406 } = __VLS_404.slots;
        const __VLS_407 = SourcePaperPreview;
        // @ts-ignore
        const __VLS_408 = __VLS_asFunctionalComponent1(__VLS_407, new __VLS_407({
            ...{ 'onUpdate:regions': {} },
            ...{ 'onRecognize': {} },
            paper: (__VLS_ctx.selectedPaper),
            question: (__VLS_ctx.selectedQuestion),
            recognizing: (__VLS_ctx.recognizing),
        }));
        const __VLS_409 = __VLS_408({
            ...{ 'onUpdate:regions': {} },
            ...{ 'onRecognize': {} },
            paper: (__VLS_ctx.selectedPaper),
            question: (__VLS_ctx.selectedQuestion),
            recognizing: (__VLS_ctx.recognizing),
        }, ...__VLS_functionalComponentArgsRest(__VLS_408));
        let __VLS_412;
        const __VLS_413 = {
            /** @type {typeof __VLS_412.'update:regions'} */
            'onUpdate:regions': (__VLS_ctx.updateRegions),
        };
        const __VLS_414 = {
            /** @type {typeof __VLS_412.recognize} */
            onRecognize: (__VLS_ctx.reprocessSelected),
        };
        var __VLS_410;
        var __VLS_411;
        // @ts-ignore
        [page, selectedPaper, selectedPaper, selectedQuestion, selectedQuestion, recognizing, updateRegions, reprocessSelected,];
        var __VLS_404;
    }
    if (__VLS_ctx.layoutOpen && __VLS_ctx.selectedQuestion) {
        const __VLS_415 = LayoutCanvasEditor;
        // @ts-ignore
        const __VLS_416 = __VLS_asFunctionalComponent1(__VLS_415, new __VLS_415({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            ...{ 'onQuestionUpdated': {} },
            question: (__VLS_ctx.selectedQuestion),
            saving: (__VLS_ctx.busy),
        }));
        const __VLS_417 = __VLS_416({
            ...{ 'onClose': {} },
            ...{ 'onSave': {} },
            ...{ 'onQuestionUpdated': {} },
            question: (__VLS_ctx.selectedQuestion),
            saving: (__VLS_ctx.busy),
        }, ...__VLS_functionalComponentArgsRest(__VLS_416));
        let __VLS_420;
        const __VLS_421 = {
            /** @type {typeof __VLS_420.close} */
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
        const __VLS_422 = {
            /** @type {typeof __VLS_420.save} */
            onSave: (__VLS_ctx.saveLayout),
        };
        const __VLS_423 = {
            /** @type {typeof __VLS_420.questionUpdated} */
            onQuestionUpdated: (__VLS_ctx.updateQuestionFromLayout),
        };
        var __VLS_418;
        var __VLS_419;
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
[saveLayout, updateQuestionFromLayout, toast, toast,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
