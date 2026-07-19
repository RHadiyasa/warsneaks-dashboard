import { SignJWT, jwtVerify } from "jose"; import { cookies } from "next/headers";
const key=()=>new TextEncoder().encode(process.env.AUTH_SECRET||"phase1-local-only-secret-change-in-production");
export const cookieName="warsneaks_session";
export async function createSession(userId:string,workspaceId:string){return new SignJWT({userId,workspaceId}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(key())}
export async function readSession(){const token=(await cookies()).get(cookieName)?.value;if(!token)return null;try{return (await jwtVerify(token,key())).payload as {userId:string;workspaceId:string}}catch{return null}}
export async function verifyCredentials(email:string,password:string){const expectedEmail=process.env.DEMO_EMAIL||"owner@warsneaks.local";const expectedPassword=process.env.DEMO_PASSWORD||"change-me-before-production";return email===expectedEmail&&password===expectedPassword?{userId:"demo-owner",workspaceId:"demo-workspace"}:null}
