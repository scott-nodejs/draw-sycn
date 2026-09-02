<script setup lang="ts">
import { ChevronLeft,ChevronRight,ImageOff } from 'lucide-vue-next'
import type { Question } from '../api'
import AuthenticatedImage from './AuthenticatedImage.vue'
import QuestionFinalPreview from './QuestionFinalPreview.vue'

const props=defineProps<{questions:Question[];index:number}>()
const emit=defineEmits<{change:[index:number]}>()
const move=(offset:number)=>emit('change',Math.max(0,Math.min(props.questions.length-1,props.index+offset)))
</script>

<template>
 <section v-if="questions.length" class="question-compare">
  <header class="question-compare-head">
   <div><b>第 {{questions[index].number}} 题</b><span>{{questions[index].sourceTitle}}</span></div>
   <div class="question-compare-nav"><button :disabled="index===0" title="上一题" @click="move(-1)"><ChevronLeft/>上一题</button><span>{{index+1}} / {{questions.length}}</span><button :disabled="index===questions.length-1" title="下一题" @click="move(1)">下一题<ChevronRight/></button></div>
  </header>
  <div class="question-compare-grid">
   <article><div class="question-compare-label"><span>解析结果</span><small>结构化题目</small></div><QuestionFinalPreview :question="questions[index]"/></article>
   <article><div class="question-compare-label"><span>原始图片</span><small>识别前裁图</small></div><div v-if="questions[index].cropUrls?.length" class="question-original-images"><AuthenticatedImage v-for="(path,imageIndex) in questions[index].cropUrls" :key="path" :path="path" :alt="`第 ${questions[index].number} 题原图 ${imageIndex+1}`"/></div><div v-else class="question-original-empty"><ImageOff/><b>没有原始裁图</b><span>该题可能来自手动录入或历史数据尚未生成裁图</span></div></article>
  </div>
 </section>
</template>
