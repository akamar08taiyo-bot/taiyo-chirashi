import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateImagePlacement } from '../dist/utils/photoFit.js';
import { renderPaper } from '../dist/features/editor/paper.js';
import { createDemoContext, createDefaultEditorState } from '../dist/services/demoData.js';

test('portrait photo contain mode keeps the full photo inside a landscape frame',()=>{
  const p=calculateImagePlacement(600,1000,1000,500,{scale:100,x:50,y:50,rotation:0,fitMode:'contain'});
  assert.equal(p.fitMode,'contain');
  assert.equal(Math.round(p.height),500);
  assert.equal(Math.round(p.width),300);
});

test('landscape photo cover mode fills a landscape frame',()=>{
  const p=calculateImagePlacement(1200,650,1000,500,{scale:100,x:50,y:50,rotation:0,fitMode:'cover'});
  assert.equal(p.fitMode,'cover');
  assert.ok(p.width>=1000);
  assert.ok(p.height>=500);
});

test('A4 preview persists contain and cover per photo',()=>{
  const context=createDemoContext(); const state=createDefaultEditorState(2);
  state.items[0].media={mediaId:null,previewUrl:'portrait.jpg',originalUrl:'portrait.jpg',localBlobKey:null,fileName:'portrait.jpg'};
  state.items[0].transform.fitMode='contain';
  state.items[1].media={mediaId:null,previewUrl:'landscape.jpg',originalUrl:'landscape.jpg',localBlobKey:null,fileName:'landscape.jpg'};
  state.items[1].transform.fitMode='cover';
  const record={id:'test',organizationId:context.organization.id,officeId:context.offices[0].id,ownerId:context.profiles[0].id,assigneeId:context.profiles[0].id,title:state.title,categoryId:context.categories[0].id,shareScope:'private',orientation:'portrait',layoutCount:2,designStyle:state.design.style,mainColor:state.design.color,editorState:state,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deletedAt:null};
  const html=renderPaper(record,context,-1,false);
  assert.match(html,/object-fit:contain/);
  assert.match(html,/object-fit:cover/);
});
