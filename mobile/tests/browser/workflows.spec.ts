import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
const api="http://127.0.0.1:8019";
async function signIn(request:APIRequestContext,phone:string) {
  const challenge=await request.post(api+"/auth/otp/request",{data:{phone}});expect(challenge.ok()).toBeTruthy();
  const response=await request.post(api+"/auth/otp/verify",{data:{phone,challenge_id:(await challenge.json()).challenge_id,code:"123456"}});
  expect(response.ok()).toBeTruthy();return response.json();
}
async function mount(page:Page,tokens:any,property:any,path:string) {
  await page.addInitScript(({tokens,property})=>{
    sessionStorage.setItem("society.session.v1",JSON.stringify(tokens));
    if(property)sessionStorage.setItem("society.property.v1",JSON.stringify(property));
  },{tokens,property});
  await page.goto(path);
}
test("office onboarding, billing preview, resident approval, and guard entry",async({browser,request})=>{
  const suffix=String(Date.now()).slice(-7);
  const adminTokens=await signIn(request,"+91911"+suffix);
  const auth={Authorization:`Bearer ${adminTokens.access_token}`};
  const context=await browser.newContext();const admin=await context.newPage();const errors:string[]=[];
  admin.on("pageerror",e=>errors.push(e.message));
  await mount(admin,adminTokens,null,"/onboarding");
  await admin.getByText("Create a society",{exact:true}).first().click();
  await admin.getByLabel("Society name",{exact:true}).fill("Browser Test "+suffix);
  await admin.getByLabel("Address",{exact:true}).fill("Bengaluru test address, India");
  await admin.getByRole("button",{name:"Create society",exact:true}).click();
  await admin.getByRole("button",{name:new RegExp("Browser Test "+suffix)}).click();
  await expect(admin.getByText("Society Setup",{exact:true})).toBeVisible();
  await admin.getByText("Society Setup",{exact:true}).click();
  await admin.getByLabel("Building / tower",{exact:true}).fill("A");
  await admin.getByLabel("Flat number",{exact:true}).fill("101");
  await admin.getByLabel("Area in square feet",{exact:true}).fill("1000");
  await admin.getByRole("button",{name:"Add flat",exact:true}).click();
  await expect(admin.getByText("A / 101",{exact:true})).toBeVisible();
  const properties=await (await request.get(api+"/properties",{headers:auth})).json();
  const property=properties.find((p:any)=>p.society==="Browser Test "+suffix);
  const headers={...auth,"X-Property-Id":property.id};
  const setup=await (await request.get(api+"/admin/setup",{headers})).json();const unit=setup.units[0];
  const residentPhone="+91912"+suffix;const guardPhone="+91913"+suffix;
  expect((await request.post(api+"/admin/setup/members",{headers,data:{unit_id:unit.id,name:"Resident",phone:residentPhone,role:"Owner"}})).ok()).toBeTruthy();
  expect((await request.post(api+"/admin/setup/staff",{headers,data:{name:"Gate Guard",phone:guardPhone,role:"Guard"}})).ok()).toBeTruthy();
  await admin.goto("/admin/finance-tools");
  await admin.getByLabel("Charge name").fill("Maintenance");await admin.getByLabel("₹ per flat").fill("2500");
  await admin.getByRole("button",{name:"Add billing rule"}).click();
  await expect(admin.getByText(/Maintenance ·/)).toBeVisible();
  await admin.getByText("Monthly bills",{exact:true}).click();
  await admin.getByRole("button",{name:"Preview bills"}).click();
  await expect(admin.getByText(/New charges:/)).toBeVisible();
  await admin.getByRole("button",{name:"Publish bills"}).click();
  const residentTokens=await signIn(request,residentPhone);const guardTokens=await signIn(request,guardPhone);
  const residentProperties=await (await request.get(api+"/properties",{headers:{Authorization:`Bearer ${residentTokens.access_token}`}})).json();
  const guardProperties=await (await request.get(api+"/properties",{headers:{Authorization:`Bearer ${guardTokens.access_token}`}})).json();
  const gh={Authorization:`Bearer ${guardTokens.access_token}`,"X-Property-Id":guardProperties[0].id};
  const visitor=await (await request.post(api+"/guard/visitors/walk-in",{headers:gh,data:{unit_id:unit.id,name:"Browser Guest",phone:"+919876543210",purpose:"Visit resident"}})).json();
  expect(visitor.status).toBe("Waiting");
  const residentContext=await browser.newContext();const resident=await residentContext.newPage();
  await mount(resident,residentTokens,residentProperties[0],"/visitors");
  await expect(resident.getByText("Browser Guest",{exact:true})).toBeVisible();
  await resident.getByRole("button",{name:"Allow entry",exact:true}).click();
  await expect(resident.getByText("Allow this visitor?",{exact:true})).toBeVisible();
  await resident.getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(resident.getByText("Allowed",{exact:true})).toBeVisible();
  const guardContext=await browser.newContext();const guard=await guardContext.newPage();
  await mount(guard,guardTokens,guardProperties[0],"/guard");
  await guard.getByRole("button",{name:"Record entry",exact:true}).click();
  await expect(guard.getByRole("button",{name:"Mark Exit",exact:true})).toBeVisible();
  const parcelResponse = await request.post(api+"/guard/parcels", {headers:gh,
    data:{unit_id:unit.id,courier:"Browser courier",recipient_name:"Resident"}});
  expect(parcelResponse.ok()).toBeTruthy();
  const parcel = await parcelResponse.json();
  expect(parcel.otp).toBeUndefined();
  await resident.goto("/parcels");
  await expect(resident.getByText("Browser courier · Resident",{exact:true})).toBeVisible();
  const pickup = await resident.getByText(/^Pickup code: /).innerText();
  expect((await request.post(api+`/guard/parcels/${parcel.id}/collect`,{
    headers:gh,data:{otp:pickup.split(": ")[1]}})).ok()).toBeTruthy();
  await resident.reload();
  await expect(resident.getByText("Collected",{exact:true})).toBeVisible();
  await expect(resident.getByText(/^Pickup code: /)).toHaveCount(0);
  await admin.goto("/admin/finance-tools");await admin.getByText("Flat ledger",{exact:true}).click();
  await admin.getByText("A / 101",{exact:true}).click();await expect(admin.getByText(/Outstanding:/)).toBeVisible();
  await admin.screenshot({path:"/tmp/neighbourly-office.png",fullPage:true});
  await guard.screenshot({path:"/tmp/neighbourly-guard.png",fullPage:true});
  const treasurerPhone="+91914"+suffix;
  expect((await request.post(api+"/admin/setup/staff",{headers,
    data:{name:"Treasurer",phone:treasurerPhone,role:"Treasurer"}})).ok()).toBeTruthy();
  const treasurerTokens=await signIn(request,treasurerPhone);
  const treasurerProperties=await (await request.get(api+"/properties",{
    headers:{Authorization:`Bearer ${treasurerTokens.access_token}`}})).json();
  const treasurerContext=await browser.newContext();const treasurer=await treasurerContext.newPage();
  await mount(treasurer,treasurerTokens,treasurerProperties[0],"/admin");
  await expect(treasurer.getByText("Office Accounts",{exact:true})).toBeVisible();
  await expect(treasurer.getByText("Recent Society Complaints",{exact:true})).toHaveCount(0);
  await expect(treasurer.getByText("Society Setup",{exact:true})).toHaveCount(0);
  await treasurer.getByText("Office Accounts",{exact:true}).click();
  await expect(treasurer.getByText(/Maintenance ·/)).toBeVisible();
  expect(errors).toEqual([]);
  await Promise.all([context.close(),residentContext.close(),guardContext.close(),treasurerContext.close()]);
});
