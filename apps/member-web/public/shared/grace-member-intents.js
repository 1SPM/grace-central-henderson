/* Source-independent navigation and truthful capability boundaries. No member data. */
(function(global){
  const rows=[
    ['01',/what can (i do|you do)|what.*do here/i,'Would you like to explore the weekly message or connect with people?'],
    ['02',/new to (the )?(platform|app|portal)/i,'Welcome. Are you already connected with your church, or getting to know it?'],
    ['03',/already (attend|a member|go to)/i,'What would you like help finding in the portal?'],
    ['04',/help me decide|not sure where to start/i,'Would you rather explore a message or find a group?'],
    ['05',/just (looking|browsing)|never mind|nevermind|^cancel that[.!\s]*$/i,'Of course. I’ll leave you to explore.'],
    ['06',/guide me through|show me around/i,'Let’s take one step at a time. Would you like to start with the weekly message?','study','Open Bible Study'],
    ['07',/what time.*(service|sunday)/i,'Check the dated schedule in Watch. I can’t confirm a current service time from the demo schedule.','watch','Open Watch'],
    ['11',/missed (church|the service)|last week.*(sermon|message)|catch up.*(church|sermon)/i,'Would you like to find the recording or explore a Scripture passage? Watch currently contains demo listings; I can’t identify last week’s actual sermon from them.','watch','Browse Watch'],
    ['12',/who (preached|spoke)/i,'Which service date do you mean? I can help you check the speaker in Watch, but demo listings aren’t a verified current schedule.','watch','Browse Watch'],
    ['13',/(play|watch|open).*(latest|last|sermon|message)/i,'You can browse the recordings in Watch. The current preview video is not a verified recording of the latest sermon.','watch','Open Watch'],
    ['14',/summari[sz]e.*(sermon|message)|main (point|idea)|week before|previous sunday/i,'I don’t have an approved, dated sermon summary here. I can show the Watch listings; I won’t substitute a demo lesson for the actual message.','watch','Browse Watch'],
    ['15',/main passage|what.*(scripture|passage).*(sermon|message)/i,'Open the selected weekly lesson to see its Scripture reference. Demo references do not confirm what was preached last Sunday.','study','Open Bible Study'],
    ['21',/help.*reflect|reflect on.*(sermon|message)/i,'The weekly lesson has optional reflection prompts. You can choose one or write freely.','journal','Open Journal'],
    ['22',/personal reflection/i,'In Journal, choose Personal reflection to write without linking your entry to a lesson.','journal','Open Journal'],
    ['23',/save (what|my|this|the).*(wrote|reflection|entry|note)/i,'Use Save reflection in Journal. It stays only in this open page and clears on reload; I haven’t saved anything through this chat.','journal','Open Journal'],
    ['24',/continue.*reflection|earlier reflection/i,'Choose the original week in Journal to return to work from this open session. I can’t recover entries cleared by a reload.','journal','Open Journal'],
    ['25',/delete.*(reflection|journal|entry)/i,'Use Delete beside the specific saved reflection and confirm it. I haven’t deleted anything.','journal','Open Journal'],
    ['27',/read my.*(notes|journal)|private notes/i,'Saving a journal entry does not send its contents to GRACE. Select specific text and review the sharing confirmation if you want help with it.'],
    ['28',/ask grace about.*(words|text)|share.*(reflection|journal)/i,'Select the words in Journal, choose Ask GRACE, then review and confirm the exact text before sending.','journal','Open Journal'],
    ['29',/dictate.*(thought|reflection)|voice.*journal/i,'Journal offers optional dictation with browser permission and transcript review. Browser speech processing may use an external service.','journal','Open Journal'],
    ['30',/cancel.*recording/i,'Use Cancel dictation in the recording panel to discard its transcript. I can’t stop a separate recording from this chat.'],
    ['52',/really.*pastor|real pastor|avatar.*person/i,'A leader’s AI avatar is not a live conversation with the pastor. Use the church’s human care channel to contact a person.','outreach','Open Care'],
    ['53',/need someone to talk|talk to (a person|someone)/i,'Would you like to explore the church’s human care options? This preview cannot promise a response time.','outreach','Open Care'],
    ['54',/how.*care requests.*work/i,'The care page explains the available options. A preview is not a submitted request, and I can’t confirm an appointment or staff receipt without a connected service.','outreach','Open Care'],
    ['97',/microphone|mic.*(stop|red|work)|voice.*not working/i,'Check the error shown beside the mic. A red indicator alone does not confirm recognition. If the browser speech service cannot connect, try the served portal in standalone Chrome or type your message.']
  ];
  const normalize=text=>String(text).trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/^i missed the church\b/i,'I missed church');
  // Domain coverage offers existing controls, never pretends to execute a mutation.
  const domains=[
    ['account',/settings|notification|change my (name|email)|switch (church|account)|forget my preferences/i,'Settings shows the controls currently available. Account changes and notification delivery are not connected in this preview.','settings','Open Settings'],
    ['memory',/what.*remember about me|clear.*memory/i,'I can explain the preview’s browser-local preferences. Clearing preferences is separate from deleting account data or chat records. Review the relevant control before confirming.','settings','Open Settings'],
    ['giving-support',/receipt|recurring gift|contribution go|recognize a transaction|transaction.*recognize/i,'I can open the giving page. Its records are illustrative; use the official church or card-provider channel for a real receipt, payment change or disputed transaction.','give','Open giving'],
    ['impact',/impact card|spending example|cause.*example|actual donation|giving.*growth score/i,'The Impact example illustrates how spending could support a cause. It is not a donation, a live card account, or a measure of spiritual growth.','impact-example','Explore the example'],
    ['gift',/make a (gift|donation)|give.*money/i,'You can review the demo giving flow. No real payment should be inferred from this preview.','give','Open giving'],
    ['group-change',/\b(join|leave) (this |my |a )?group\b/i,'Open the group details to check the available membership controls. I haven’t joined or left a group for you.','groups','Open Groups'],
    ['events',/event|registration|register me/i,'Check the event’s date, location, cost and registration details in Connect. Opening it does not register or cancel anything.','events','Browse events'],
    ['groups',/group|small group|meet evenings/i,'Let’s look at the groups listed in Connect. You can check meeting times and details before deciding.','groups','Browse groups'],
    ['volunteer',/volunteer|serve together|background check|training.*required|coordinat.*ministry|my shift|availability|ready to commit|only have an hour|sign me up for this role/i,'The volunteer page outlines sample opportunities. Confirm training, screening and schedules with the church before committing; I haven’t registered you.','volunteer','Explore volunteering'],
    ['care-status',/received my request|appointed|appointment|arrange counseling|visit me in hospital|help with food|grieving/i,'I can show the church care options. This preview cannot confirm receipt, arrange an appointment or promise a response time.','outreach','Open Care'],
    ['leadership',/who is my pastor|who.*lead/i,'The leadership page shows the demo directory. A displayed leader is not proof of a personal assignment or current availability.','ai','View leadership'],
    ['goal-actions',/\bgoal\b|weekly action|completed my action|undo.*completion|pause.*action/i,'Review your chosen action in Goals. You can adopt, edit, pause or mark it complete there; I haven’t changed it through this chat.','goals','Open Goals'],
    ['growth',/growing|mountain|falling behind|try next week/i,'Growth reflects the actions you choose and explicitly complete, not spiritual worth or a comparison with other members.','growth','View Growth'],
    ['journal-export',/export.*journal|find.*saved|what i saved/i,'Session reflections are available only in the open page. Journal provides explicit export; reloading clears those entries.','journal','Open Journal'],
    ['scripture',/\b(bible|verse|chapter|translation|scripture|interpretation)\b|what does this word mean|study.*match/i,'Bible Study separates exact attributed Scripture from demo questions and generated guidance. Open the passage to read its context; I won’t invent text or an unavailable translation.','study','Open Bible Study'],
    ['watch',/sermon|series|service live|leave off watching|church last week/i,'Watch contains demo listings. I can help you browse them, but can’t verify current live status or recover an unrecorded playback position.','watch','Open Watch'],
    ['church-info',/where is the church|childcare|what did i miss/i,'Which information would help: visiting the church or catching up on a message? Current arrangements need confirmation from the church.'],
    ['staff-question',/ask staff|send.*staff/i,'I can’t confirm a staff submission from this preview. Use the church’s established contact channel; nothing has been sent on your behalf.'],
    ['display-help',/page.*(wrong|phone)|phone.*page/i,'Which part looks wrong: the page width, text, or a control? Tell me the page name so we can narrow it down.']
  ];
  global.GRACE_MEMBER_INTENTS={resolve(text){
    const publicLesson=global.FAITHFUL_PUBLIC_LESSON?.();
    if(publicLesson?.status==='demo'&&/main passage|selected passage|help.*reflect/i.test(String(text))){
      const reflect=/reflect/i.test(String(text));
      return {scenario:reflect?'21':'15',sourceLesson:publicLesson,intent:'member-guidance',text:reflect?'For the selected demo lesson: '+publicLesson.prompts[0]:'The selected demo lesson uses '+publicLesson.ref+' ('+publicLesson.translation+'). This identifies the demo, not last Sunday’s actual sermon.',nav:reflect?'journal':'study',navLabel:reflect?'Open Journal':'Open Bible Study'};
    }
    if(/immediate danger/i.test(String(text)))return {intent:'care',care:true,text:'If someone is in immediate danger, contact local emergency services now. This portal cannot dispatch help.',nav:'outreach',navLabel:'Emergency and care options'};
    if(/not that sunday|previous one/i.test(String(text)))return {scenario:'14',intent:'member-guidance',text:'Which service date do you mean? I can browse the dated demo listings, but cannot verify the actual message without current church records.',nav:'watch',navLabel:'Browse Watch'};
    if(/compare.*translations/i.test(String(text)))return {scenario:'scripture',intent:'member-guidance',text:'This demo reader contains the World English Bible. A comparison requires another available, licensed edition; I won’t invent or relabel its text.',nav:'study',navLabel:'Open Bible Study'};
    const row=rows.find(r=>r[1].test(normalize(text)))||domains.find(r=>r[1].test(normalize(text)));
    return row?{scenario:row[0],preferService:domains.includes(row),intent:'member-guidance',text:row[2],nav:row[3],navLabel:row[4]}:null;
  },useService(result,memberIdentity){
    // Broad demo explanations must not shadow authenticated, tool-grounded answers.
    // Source-specific passages and navigation confirmations stay deterministic.
    return !!(memberIdentity&&result?.preferService&&!result.navigateNow&&!result.sourceLesson);
  },ids:rows.map(r=>r[0]),createSession(){
    let pending=null,owner=null,expires=0;
    const reset=()=>{pending=null;expires=0;};
    const answer=(text,nav,navLabel)=>({intent:'member-guidance',text,nav,navLabel});
    return {reset,reply(input,identity){
      if(owner!==identity){reset();owner=identity;}
      if(Date.now()>expires)reset();
      const t=normalize(input);
      const previous=pending;
      if(/^(never ?mind|cancel( that)?|no[, ]+(keep it|don.t send it)|stop|no( thanks)?|not now|maybe later)[.!\s]*$/i.test(t)){
        reset();return answer('Of course. I won’t continue with that.');
      }
      let result=null;
      // A qualified refusal must not fall through to an older keyword handler.
      if(/\b(don't|do not|not yet)\b.*\b(open|send|share|delete|save|register|give|donate)\b/i.test(t)){
        reset();return answer('Understood. I won’t take that action. We can talk it through without making changes.');
      }
      if(/\b(open|find|show)\b.+\band\b.+\b(open|find|show)\b/i.test(t)){
        reset();return answer('Let’s do one thing at a time. Which would you like to start with?');
      }
      // Explicit page requests use the same navigation adapter as visible buttons.
      // Match complete destinations, never execute URLs or model-written commands.
      const command=t.match(/^(?:(?:can|could|would) you |please )?(?:open|show(?: me)?|take me to|go to|so me) (?:the )?(.+?)(?: page)?[.!?]*$/i);
      if(command){
        const destinations={
          'home':['home','My Church'],'my church':['home','My Church'],
          'groups':['groups','Groups'],'events':['events','Events'],
          'connect':['groups','Connect'],'volunteer':['volunteer','Volunteer'],'volunteering':['volunteer','Volunteer'],
          'leadership':['ai','My Leadership'],'my leadership':['ai','My Leadership'],
          'journal':['journal','Journal'],'reflect':['profile','Reflect'],'my journey':['profile','Reflect'],'journey':['profile','Reflect'],
          'bible study':['study','Bible Study'],'growth':['growth','Growth'],'goals':['goals','Goals'],
          'settings':['settings','Settings'],'care':['outreach','Care'],'pastoral care':['outreach','Care'],
          'watch':['watch','Watch'],'giving':['give','Giving'],'wallet':['wallet','Wallet'],
          'impact card':['impact-example','Impact Card'],'first step':['first-step','First Step']
        };
        const destination=destinations[command[1].toLowerCase().trim()];
        if(destination){reset();return {...answer('Let’s open '+destination[1]+'.',destination[0],'Open '+destination[1]),navigateNow:true};}
        if(/^(?:worship )?team$/i.test(command[1])){
          pending={...answer('I can open Groups to look for a team. I don’t have a verified separate team page. Open Groups?','groups','Open Groups'),scenario:'team-navigation'};
          expires=Date.now()+5*60*1000;return pending;
        }
      }
      const newTopic=global.GRACE_MEMBER_INTENTS.resolve(t);
      // An explicit new request takes precedence over broad follow-up words like "years".
      if(previous && newTopic && newTopic.scenario!==previous.scenario && !/^(yes|no|actually|the week before|just the main point)/i.test(t)){
        pending=newTopic;expires=Date.now()+5*60*1000;return newTopic;
      }
      if(previous){
        const id=previous.scenario;
        if(/^(yes([, ]+please)?|yes[, ]+(open it|start there)|yep|yup|sure|okay|ok|sounds good|open it|go ahead|please do|let's do that)[.!\s]*$/i.test(t)&&previous.nav){
          result={...answer('Let’s open that page.',previous.nav,previous.navLabel),navigateNow:true};
        }else if(['01','04','06','11'].includes(id)&&/^(the )?(weekly message|message|scripture|passage)([, ]+please)?[.!\s]*$/i.test(t)){
          result=answer('We can explore the demo lesson together. Would you like to open Bible Study?','study','Open Bible Study');
        }else if(['01','03','04','05'].includes(id)&&/^(find a group|my small group|people|a group|actually,? help me find a group)[.!\s]*$/i.test(t)){
          result=answer('Let’s look at the groups listed in Connect.','groups','Open Groups');
        }else if(id==='02'&&/\b(not|never|don't|do not)\b.*\b(attend|member|church)\b/i.test(t)){
          result=answer('You’re welcome to explore at your pace. Would you like to see an introduction to the church?','first-step','Explore First Step');
        }else if(id==='02'&&/attend|member|years/i.test(t)){
          result=answer('Then we can start with the church life you already have. Would you like to find your group?','groups','Open Groups');
        }else if(['07','12','24'].includes(id)&&/sunday|may 11|week before/i.test(t)){
          result=answer(id==='24'?'Choose the matching dated lesson in Journal. Any reflection from this open session stays with its original week. I won’t assume which date you mean by Sunday.':'Thanks. The preview doesn’t have a verified current schedule for that date. We can browse the dated listings without treating them as current.',id==='24'?'journal':'watch',id==='24'?'Open Journal':'Browse Watch');
        }else if(['11','14'].includes(id)&&/\b(no|not|don't|do not)\b.*demo/i.test(t)){
          result=answer('Understood. I won’t substitute demo material. I don’t have a verified current sermon summary here.');
        }else if(['11','14'].includes(id)&&/demo|main point/i.test(t)){
          result=answer('We can use the clearly labeled forgiveness demo instead. Would you like to open its passage and questions?','study','Open Bible Study');
        }else if(id==='15'&&/read it/i.test(t)){
          const l=previous.sourceLesson||global.FAITHFUL_PUBLIC_LESSON?.();
          result=l?.status==='demo'?answer(l.ref+' · '+l.translation+'\n“'+l.verse+'”\nThis is the passage in the selected demo lesson.','study','Open Bible Study'):answer('Open Bible Study to see the selected passage and its translation. I don’t have the selected text in this conversation, so I won’t guess it.','study','Open Bible Study');
          if(l?.status==='demo')result.sourceLesson=l;
        }else if(id==='21'&&/question|not sure|don't know|do not know|where.*start/i.test(t)){
          result=answer('Here’s a general reflection prompt, not a sermon summary: where could a small act of kindness make a difference this week?');
        }else if(id==='23'&&/did you save/i.test(t)){
          result=answer('No. Use Save reflection in Journal; a successful save will be confirmed there.');
        }else if(id==='27'&&/see them|see my|read them/i.test(t)){
          result=answer('The Journal does not automatically share your entries with this chat. I can respond to text you explicitly send here.');
        }else if(id==='29'&&/stor|retain|audio/i.test(t)){
          result=answer('The journal does not save an audio recording. Browser speech processing may use an external service, whose retention I can’t verify here. You can type instead.');
        }else if(id==='30'&&/stopped/i.test(t)){
          result=answer('I can’t verify that recorder from this chat. Select Cancel dictation in its panel and check that the listening indicator stops.');
        }else if(id==='52'&&/person|human/i.test(t)){
          result=answer('I can open the human care options. That does not send a request or start a live call.','outreach','Open Care');
        }else if(id==='54'&&/tonight|call me|when/i.test(t)){
          result=answer('I can’t promise a call tonight. Use the church’s established contact channel to ask about response times; the preview does not confirm staff availability.');
        }else if(id==='97'&&/network/i.test(t)){
          result=answer('That means the browser speech service could not connect. Try the same served portal in standalone Chrome. You can keep typing here while voice input is unavailable.');
        }
      }
      if(!result)result=global.GRACE_MEMBER_INTENTS.resolve(t);
      if(!result){reset();return null;}
      pending=result.navigateNow?null:{...result,scenario:result.scenario||previous?.scenario};
      expires=Date.now()+5*60*1000;
      return result;
    }};
  }};
})(typeof window!=='undefined'?window:globalThis);
