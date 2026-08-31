<script setup lang="ts">
import { CheckCircle2,X } from 'lucide-vue-next'
import type { Question } from '../api'
import MathPreview from './MathPreview.vue'

defineProps<{question:Question;saving?:boolean}>()
const emit=defineEmits<{(event:'close'):void;(event:'save',question:Question):void}>()
</script>

<template>
 <aside class="answer-editor">
  <header><div><span>ANSWER REVIEW</span><h3>答案与解析</h3><small>第 {{question.number}} 题 · {{question.type}}</small></div><button title="关闭" @click="emit('close')"><X/></button></header>
  <main>
   <section><label>正确答案</label><textarea v-model="question.answer" rows="5" placeholder="填写正确答案，支持 LaTeX 公式"/><div class="answer-render"><span>答案预览</span><MathPreview :text="question.answer||'尚未填写答案'"/></div></section>
   <section><label>正确解析</label><textarea v-model="question.analysis" rows="12" placeholder="填写完整、准确的解题过程，支持 LaTeX 公式"/><div class="answer-render analysis-render"><span>解析预览</span><MathPreview :text="question.analysis||'尚未填写解析'"/></div></section>
  </main>
  <footer><button class="primary" :disabled="saving" @click="emit('save',question)"><CheckCircle2/>{{saving?'保存中':'保存答案与解析'}}</button></footer>
 </aside>
</template>

<style scoped>
.answer-editor{min-width:0;background:#fff;border-left:1px solid #e4e9f1;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}.answer-editor header{height:78px;padding:14px 16px;border-bottom:1px solid #e7ebf1;display:flex;align-items:center;justify-content:space-between}.answer-editor header span{font-size:9px;letter-spacing:1.5px;color:#7d899b;font-weight:800}.answer-editor h3{margin:4px 0 2px;font-size:17px}.answer-editor small{color:#8490a2;font-size:10px}.answer-editor header button{width:32px;height:32px;border:0;border-radius:8px;background:#f1f4f8;color:#66738a;display:grid;place-items:center}.answer-editor header svg{width:16px}.answer-editor main{overflow:auto;padding:16px}.answer-editor section+section{margin-top:20px}.answer-editor label{display:block;margin-bottom:7px;font-size:12px;font-weight:700;color:#35435a}.answer-editor textarea{width:100%;resize:vertical;border:1px solid #dce3ed;border-radius:8px;padding:10px;outline:none;line-height:1.65;color:#243047}.answer-editor textarea:focus{border-color:#7ca5f5;box-shadow:0 0 0 3px #2864eb14}.answer-render{margin-top:9px;border:1px solid #e2e7ef;border-radius:8px;overflow:hidden;background:#fbfcfe}.answer-render>span{display:block;padding:7px 9px;background:#f1f4f8;color:#748095;font-size:10px;font-weight:700}.answer-render :deep(.math-preview){padding:10px;min-height:42px;font-size:13px;line-height:1.75}.analysis-render :deep(.math-preview){min-height:90px}.answer-editor footer{padding:13px 16px;border-top:1px solid #e5eaf1}.answer-editor footer button{width:100%}.answer-editor footer svg{width:16px}
</style>
