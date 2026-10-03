import { API_URL, request } from "./api";
import { useSession } from "./session";

export async function shareFile(path: string, filename: string) {
  await request("/residents/me");
  const session = useSession.getState();
  const response = await fetch(`${API_URL}${path}`, {headers:{Authorization:`Bearer ${session.tokens?.access_token}`,"X-Property-Id":session.property?.id ?? ""}});
  if (!response.ok) throw new Error("Could not export this file.");
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement("a");link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function chooseFile(accept:string):Promise<File|null> {
  return new Promise(resolve=>{
    const input=document.createElement("input");input.type="file";input.accept=accept;
    input.onchange=()=>resolve(input.files?.[0] ?? null); input.oncancel=()=>resolve(null);input.click();
  });
}

export async function uploadDocument(title:string,category:string,ownersOnly:boolean) {
  const file=await chooseFile("application/pdf,image/jpeg,image/png,image/webp");if(!file)return;
  const data=new FormData();data.append("file",file);
  await request(`/admin/resources/documents?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category)}&owners_only=${ownersOnly}`,{method:"POST",body:data});
}

export async function pickImage():Promise<{id:string;uri:string}|null> {
  const file=await chooseFile("image/jpeg,image/png,image/webp");if(!file)return null;
  const data=new FormData();data.append("file",file);
  const result=await request<{id:string}>("/uploads",{method:"POST",body:data});
  return {id:result.id,uri:URL.createObjectURL(file)};
}
