export type RtcConnectionState='DISCONNECTED'|'JOINING'|'CONNECTED'|'RECONNECTING'
export type RtcCredentials={sdkAppId:number;roomId:string;userId:string;userSig:string;publishAudio:boolean;expiresAt:number}
export interface RtcProvider{joinRoom(credentials:RtcCredentials):Promise<void>;leaveRoom():Promise<void>;publishMicrophone():Promise<void>;unpublishMicrophone():Promise<void>;muteMicrophone():Promise<void>;unmuteMicrophone():Promise<void>;onStateChange(listener:(state:RtcConnectionState)=>void):()=>void}
