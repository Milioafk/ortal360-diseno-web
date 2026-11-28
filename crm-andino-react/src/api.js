export const API_URL=(import.meta.env.VITE_API_URL || '/api').replace(/\/$/,'');
export async function api(path,{method='GET',token,body}={}) {
  const res=await fetch(API_URL+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'HTTP '+res.status);
  return data;
}