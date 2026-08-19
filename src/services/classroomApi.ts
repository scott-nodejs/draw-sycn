import{getAuthToken,getStoredSession}from'./authService'
import type{RtcCredentials}from'./rtc/RtcProvider'
const BASE=import.meta.env.VITE_API_BASE_URL||'http://127.0.0.1:8788/api'
export type ClassroomMember={studentId:string;studentName:string;presenceStatus:'ONLINE'|'OFFLINE';canPublishAudio:boolean;canWriteCanvas:boolean}
export type HandRaiseItem={id:string;studentId:string;studentName:string;status:'WAITING'|'INVITED'|'CONNECTING'|'CONNECTED';raisedAt:string;waitSeconds:number}
export type ClassroomEvent={id:number;event:string;roomId:string;userId:string;targetUserId:string;timestamp:number;payload:Record<string,unknown>}
async function call<T>(path:string,init:RequestInit={}){const h=new Headers(init.headers);const token=getAuthToken();const user=getStoredSession()?.user;if(token)h.set('Authorization',`Bearer ${token}`);if(user)h.set('X-User-Id',user.id);const r=await fetch(`${BASE}${path}`,{...init,headers:h});const p=await r.json().catch(()=>null);if(!r.ok)throw new Error(p?.message||`课堂服务请求失败 (${r.status})`);return p as T}
const roomPath=(roomId:string)=>`/classroom/rooms/${encodeURIComponent(roomId)}`
export const classroomApi={
  rtcToken:(id:string)=>call<RtcCredentials>(`${roomPath(id)}/rtc/token`,{method:'POST'}),
  connected:(id:string)=>call<void>(`${roomPath(id)}/rtc/connected`,{method:'POST'}),
  rtcLeave:(id:string)=>call<void>(`${roomPath(id)}/rtc/leave`,{method:'POST'}),
  mute:(id:string,muted:boolean)=>call<void>(`${roomPath(id)}/rtc/${muted?'mute':'unmute'}`,{method:'POST'}),
  members:(id:string)=>call<ClassroomMember[]>(`${roomPath(id)}/members`),
  handRaises:(id:string)=>call<HandRaiseItem[]>(`${roomPath(id)}/hand-raises`),
  invite:(id:string,studentId:string)=>call(`${roomPath(id)}/students/${encodeURIComponent(studentId)}/rtc/invite`,{method:'POST'}),
  reject:(id:string,studentId:string)=>call(`${roomPath(id)}/students/${encodeURIComponent(studentId)}/hand-raise/reject`,{method:'POST'}),
  kick:(id:string,studentId:string)=>call(`${roomPath(id)}/students/${encodeURIComponent(studentId)}/rtc/kick`,{method:'POST'}),
  muteStudent:(id:string,studentId:string)=>call(`${roomPath(id)}/students/${encodeURIComponent(studentId)}/rtc/mute`,{method:'POST'}),
  canvas:(id:string,studentId:string,grant:boolean)=>call(`${roomPath(id)}/students/${encodeURIComponent(studentId)}/canvas/${grant?'grant':'revoke'}`,{method:'POST'}),
  events:(id:string,afterId:number)=>call<ClassroomEvent[]>(`${roomPath(id)}/events?afterId=${afterId}`),
}
