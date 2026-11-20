const http = require('http');
function req(m,p,d,headers={}){
  return new Promise((ok,err)=>{
    const body=d?JSON.stringify(d):null;
    const r=http.request({hostname:'127.0.0.1',port:3002,path:p,method:m,headers:{...headers, ...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{
      let b='';res.on('data',x=>b+=x);res.on('end',()=>{try{ok({s:res.statusCode,j:JSON.parse(b)})}catch(e){ok({s:res.statusCode,t:b})}});
    });
    r.on('error',err); if(body) r.write(body); r.end();
  });
}
(async()=>{
  const l=await req('POST','/api/login',{username:'admin',pass:'admin123'});
  const tok=l.j.token;
  const t=await req('GET','/api/tables','',{'Authorization':'Bearer '+tok});
  console.log('tables',t.s);
  const free=t.j.find(x=>x.status==='free');
  console.log('free',free&&free.id);
  const o=await req('POST','/api/orders',{table_id:free.id},{'Authorization':'Bearer '+tok});
  console.log('open',o.s,o.j);
  const c=await req('POST','/api/orders/'+o.j.id+'/cancel',{},{'Authorization':'Bearer '+tok});
  console.log('cancel',c.s,c.j);
  const t2=await req('GET','/api/tables','',{'Authorization':'Bearer '+tok});
  console.log('after',t2.j.find(x=>x.id===free.id));
})();
