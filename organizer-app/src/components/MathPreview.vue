<script setup lang="ts">
import {computed} from 'vue'
import katex from 'katex'
const props=defineProps<{text:string}>()
function escape(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function normalizeLatex(value:string){return value.replace(/\f(?=rac\b)/g,'\\f').replace(/\r(?=ight\b)/g,'\\r').replace(/\t(?=(?:imes|heta|ext)\b)/g,'\\t').replace(/(^|[^\\A-Za-z])(sqrt|frac|dfrac|tfrac)\s*\{/g,'$1\\$2{')}
const html=computed(()=>{const source=props.text||'';let output='',last=0;const expression=/\$([^$]+)\$/g;let match:RegExpExecArray|null;while((match=expression.exec(source))){output+=escape(source.slice(last,match.index));try{output+=katex.renderToString(normalizeLatex(match[1].trim()),{throwOnError:false,strict:false})}catch{output+=escape(match[0])}last=match.index+match[0].length}return(output+escape(source.slice(last))).replace(/\n/g,'<br/>')})
</script>
<template><div class="math-preview" v-html="html"></div></template>
