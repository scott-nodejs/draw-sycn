import TRTC from 'trtc-sdk-v5'
import type {RtcConnectionState,RtcCredentials,RtcProvider} from './RtcProvider'
export class TrtcProvider implements RtcProvider{
  private client=TRTC.create();private state:RtcConnectionState='DISCONNECTED';private listeners=new Set<(state:RtcConnectionState)=>void>()
  constructor(){this.client.on(TRTC.EVENT.CONNECTION_STATE_CHANGED,e=>{if(e.state==='CONNECTED')this.setState('CONNECTED');else if(e.state==='CONNECTING')this.setState(e.isReconnecting?'RECONNECTING':'JOINING');else this.setState('DISCONNECTED')})}
  async joinRoom(c:RtcCredentials){this.setState('JOINING');try{await this.client.enterRoom({sdkAppId:c.sdkAppId,strRoomId:c.roomId,userId:c.userId,userSig:c.userSig,scene:TRTC.TYPE.SCENE_LIVE,role:c.publishAudio?TRTC.TYPE.ROLE_ANCHOR:TRTC.TYPE.ROLE_AUDIENCE,autoReceiveAudio:true,autoReceiveVideo:false});this.setState('CONNECTED')}catch(e){this.setState('DISCONNECTED');throw e}}
  async leaveRoom(){await this.unpublishMicrophone().catch(()=>undefined);await this.client.exitRoom();this.setState('DISCONNECTED')}
  async publishMicrophone(){await this.client.switchRole(TRTC.TYPE.ROLE_ANCHOR);await this.client.startLocalAudio()}
  async unpublishMicrophone(){await this.client.stopLocalAudio().catch(()=>undefined)}
  async muteMicrophone(){await this.client.updateLocalAudio({mute:true})}
  async unmuteMicrophone(){await this.client.updateLocalAudio({mute:false})}
  onStateChange(l:(state:RtcConnectionState)=>void){this.listeners.add(l);l(this.state);return()=>this.listeners.delete(l)}private setState(s:RtcConnectionState){this.state=s;this.listeners.forEach(l=>l(s))}
}
