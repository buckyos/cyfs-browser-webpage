import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
import { toast } from './lib/toast.min'
import { formatDate, LANGUAGESTYPE } from './lib/util'
import { getCountryList } from './lib/WorldArea'
require('./lib/gtag.js')
let g_mnemonicList:string[] = [];
let g_mnemonicStr:string = '';
g_mnemonicList
let g_areaList: {
    id:string,
    cname:string,
    name:string,
    states:{
        id:string,
        cname:string,
        name:string,
        cities:{
            id:string,
            cname:string,
            name:string,
        }[]
    }[]
}[] = [];
let g_ip:string = '';
let g_ipArr:string[] = [];
let g_token:string = '';
let g_country:number = 0;
let g_state:number = 0;
let g_city:number = 0;
let g_didName:string = '';
let g_oodName:string = '';
let g_peopleInfo:{
    objectId: cyfs.ObjectId,
    object: cyfs.People,
    privateKey: cyfs.PrivateKey,
    path: string
};
let g_deviceInfo:{
    device: cyfs.Device,
    privateKey: cyfs.PrivateKey,
};
let g_uniqueId:string = '';
let g_countDown:number = 3;
let g_isResetDid:boolean = false;
let g_buyOodAfterTime: number;
if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'accessToken') {
                g_token = arr[i].split('=')[1];
            }
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'ip') {
                g_ipArr = arr[i].split('=')[1].replace("[","").replace("]","").split(',');
                if(g_ipArr.length == 1){
                    let ipSplitArr = g_ipArr[0].split(':');
                    if((ipSplitArr.length == 1) || (ipSplitArr.length == 2 && ipSplitArr[1] == '' )){
                        g_ip = ipSplitArr[0] + ':1320';
                    }else{
                        g_ip = g_ipArr[0];
                    }
                }
                console.origin.log('g_ipArr', g_ipArr, g_ip)
            }
            let isResetDid = localStorage.getItem('is-reset-did');
            if(isResetDid == 'true'){
                g_isResetDid = true;
                window.location.href = `cyfs://static/reset_did.html?action=bindVood&ip=${g_ip}&accessToken=${g_token}`;
            }else{
                $('.create_did_container, .create_did_step_one_box').css('display', 'block');
            }
        }
    }
    
}

window.dataLayer = window.dataLayer || [];
function gtag(){
    dataLayer.push(arguments);
    console.log('dataLayer:', dataLayer)
}
gtag('js', new Date());
gtag('config', 'G-3F1C521DHQ');

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

class BuildDid {
    meta_client: cyfs.MetaClient;
    constructor() {
        this.meta_client = cyfs.create_meta_client();
    }

    async getStatus(){
        $.ajax({
            url: 'http://127.0.0.1:38090/status',
            async: false,
            success:function(result){
                console.log('getStatus-result', result);
                if(result.is_bind){
                    window.location.href = 'cyfs://static/browser.html';
                }
            }
        });
    }

    async createMnemonic () {
        let mnemonic = g_mnemonicStr = cyfs.bip39.generateMnemonic(128, undefined, cyfs.bip39.wordlists.english)
        let mnemonicList:string[] = [];
        if(mnemonic){
            mnemonicList = mnemonic.split(" ");
        }
        return mnemonicList;
    }

    async getAreaList () {
        g_areaList = await getCountryList(LANGUAGESTYPE);
    }

    async RenderArea () {
        if(!g_areaList.length){
            setTimeout(() => {
                this.RenderArea();
            }, 500);
            return;
        }
        let countryHtml:string = '<option value="">Please select your region.</option>';
        let stateHtml:string = '<option value=""></option>';
        let cityHtml:string = '<option value=""></option>';
        g_areaList.forEach((area, index)=>{
            countryHtml += `<option value="${area.id}">${LANGUAGESTYPE == 'zh'?area.cname:area.name}</option>`;
            if(index === 0){
                for (let i = 0; i < area.states.length; i++) {
                    const element = area.states[i];
                    stateHtml += `<option value="${element.id}">${LANGUAGESTYPE == 'zh'?element.cname:element.name}</option>`;
                    if(i === 0){
                        for (let k = 0; k < element.cities.length; k++) {
                            const city = element.cities[k];
                            cityHtml += `<option value="${city.id}">${LANGUAGESTYPE == 'zh'?city.cname:city.name}</option>`;
                        }
                    }
                }
            }
        })
        $('#country_select').html(countryHtml);
        $('#state_select').html(stateHtml);
        $('#city_select').html(cityHtml);
    }

    async createPeople(info: {area: cyfs.Area,mnemonic: string,network: cyfs.CyfsChainNetwork,address_index: number,name?: string,icon?: cyfs.FileId}){
        let gen = cyfs.CyfsSeedKeyBip.from_mnemonic(info.mnemonic);
        if (gen.err) {
            return gen;
        }
        let path = cyfs.CyfsChainBipPath.new_people(info.network,info.address_index);
        let private_key_r = gen.unwrap().sub_key(path);
        if (private_key_r.err) {
            return private_key_r;
        }
        let private_key = private_key_r.unwrap();
        let people = cyfs.People.create(cyfs.None, [], private_key.public(), cyfs.Some(info.area), info.name, info.icon, (build) => {
            build.no_create_time()
        });
        let people_id = people.calculate_id();
        console.log("create_people", people_id.to_base_58());
        return {
            objectId: people_id,
            object: people,
            privateKey: private_key,
            path: path.to_string()
        };
    }

    async createDevice(info:{
        unique_id: string,
        owner: cyfs.ObjectId,
        owner_private: cyfs.PrivateKey,
        area: cyfs.Area,
        network: cyfs.CyfsChainNetwork,
        address_index: number,
        account: number,
        nick_name: string,
        category: cyfs.DeviceCategory
    }){
        let gen = cyfs.CyfsSeedKeyBip.from_private_key(info.owner_private.to_vec().unwrap().toHex(), info.owner.to_base_58());
        let path = cyfs.CyfsChainBipPath.new_device(
            info.account,
            info.network,
            info.address_index,
        );
        let private_key_r = gen.unwrap().sub_key(path);
        if (private_key_r.err) {
            return private_key_r;
        }
        let private_key = private_key_r.unwrap()

        let unique = cyfs.UniqueId.copy_from_slice(str2array(info.unique_id));
        console.info(`unique_str: ${info.unique_id} -> ${unique.as_slice().toHex()}`);

        let device = cyfs.Device.create(
            cyfs.Some(info.owner),
            unique,
            [],
            [],
            [],
            private_key.public(),
            info.area,
            info.category,
            (builder) => {
                builder.no_create_time();
            }
        );
        device.set_name(info.nick_name)
        let device_id = device.calculate_id();
        console.log("create_device", device_id.to_base_58());
        let sign_ret = cyfs.sign_and_set_named_object(info.owner_private, device, new cyfs.SignatureRefIndex(254))
        if (sign_ret.err) {
            console.origin.log('sign_ret-err', sign_ret);
            return sign_ret;
        }
        return {
            device: device,
            privateKey: private_key
        }
    }

    async getUniqueId (ip:string) {
        let returnRet:boolean = false;
        try{
            const activeteResponse = await fetch(`http://${ip}/check?access_token=${g_token}`, {
                method: 'get',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            });
            const activeteRet = await activeteResponse.json();
            console.origin.log('activeteRet',activeteRet)
            if (activeteRet.result != 0) {
                returnRet = true;
                if (!activeteRet.activation) {
                    console.log(ip+'check-result', activeteRet);
                    g_uniqueId = String(activeteRet.device_info.mac_address);
                } else {
                    window.location.href = `cyfs://static/reset_did.html?action=bindVood&ip=[${ip}]&accessToken=${g_token}`;
                }
                return returnRet;
            }else{
                return returnRet;
            }
        }catch{
            returnRet = false;
            return returnRet;
        }
    }

    async transformBuckyResult(ret:cyfs.Result<cyfs.Option<[cyfs.Receipt, number]>>) {
        let result;
        if (ret.err) {
            result = { code: ret.val.code, msg: ret.val.msg };
        } else {
            result = { code: 0, value: ret.unwrap() };
        }
        return result;
    }

    async checkReceipt(txId: cyfs.TxId, checkTimeoutSecs = 300): Promise<boolean> {
        const _sleep = (ms: number) => {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }
        let interval = 1000;
        let waitTime = interval;
        let returnRet:boolean = false;
        let hasReturnRet:boolean = false;
        await _sleep(interval);
        while (waitTime < checkTimeoutSecs * 1000 && !hasReturnRet) {
            const ret = await this.transformBuckyResult(await this.meta_client.getReceipt(txId));
            console.origin.log('get receipt:', txId, ret);
            if (ret.code == 0 && ret.value.is_some()) {
                const [receipt, block] = ret.value.unwrap();
                console.origin.log('create or update desc receipt:', txId.to_base_58(), block, receipt.result);
                if (receipt && receipt.result == 0) {
                    returnRet = true;
                    hasReturnRet = true;
                }else{
                    returnRet = false;
                    hasReturnRet = true;
                }
            }
            waitTime += interval;
            await _sleep(interval);
            interval = Math.min(interval * 2, 5000);
        }
        if (waitTime >= checkTimeoutSecs * 1000) {
            console.origin.log('update desc time out:', txId);
            returnRet = false;
        }
        return returnRet;
    }

    async check_object_on_meta(id: cyfs.ObjectId): Promise<boolean> {
        const ret = await this.meta_client.getDesc(id);
        if (ret.ok) {
            ret.unwrap().match({
                People: (p: cyfs.People) => {
                    return true;
                },
                Device: (p: cyfs.Device) => {
                    return true;
                }
            })
        }
        return false;
    }

    async upChain (obj: cyfs.AnyNamedObject) {
        // getDesc up chain
        let check_p_ret = await this.check_object_on_meta(obj.calculate_id());
        console.origin.log('check_p_ret',obj.calculate_id().to_base_58(), check_p_ret);
        console.origin.log('cyfs.Device.hex', (obj as cyfs.Device||cyfs.People).to_hex().unwrap());
        let p_tx:cyfs.TxId;
        if(check_p_ret){
            let p_ret = await this.meta_client.update_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(obj).unwrap(), cyfs.None, cyfs.None, g_peopleInfo.privateKey);
            console.origin.log('update_p_ret', p_ret)
            p_tx = p_ret.unwrap();
        }else{
            let p_ret = await this.meta_client.create_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(obj).unwrap(), cyfs.JSBI.BigInt(0), 0, 0, g_peopleInfo.privateKey);
            console.origin.log('create_p_ret', p_ret)
            p_tx = p_ret.unwrap();
        }
        // check up chain
        let p_meta_success = await this.checkReceipt(p_tx)
        console.log('people desc on meta:', p_meta_success);
        return p_meta_success;
    }
  
}

function str2array(str: string): Uint8Array {
    let out = new Uint8Array(str.length);
    for(let i = 0; i < str.length; ++i) {
        out[i] = str.charCodeAt(i);
    }
    return out;
}


$('#country_select').on('change', function () {
    $('#country_select, #state_select, #city_select').css('color', '#333');
    let country = $(this).val();
    let stateHtml:string = '';
    let cityHtml:string = '';
    g_areaList.forEach((area, index)=>{
        if(country === area.id){
            for (let i = 0; i < area.states.length; i++) {
                const element = area.states[i];
                stateHtml += `<option value="${element.id}">${element.name||'--'}</option>`;
                if(i === 0){
                    for (let k = 0; k < element.cities.length; k++) {
                        const city = element.cities[k];
                        cityHtml += `<option value="${city.id}">${city.name||'--'}</option>`;
                    }
                    if(element.cities.length < 1){
                        cityHtml += `<option value="">--</option>`;
                    }
                }
            }
            if(area.states.length < 1){
                stateHtml += `<option value="">--</option>`;
                cityHtml += `<option value="">--</option>`;
            }
           
        }
    })
    $('#state_select').html(stateHtml);
    $('#city_select').html(cityHtml);
})

$('#state_select').on('change', function () {
    let country = $('#country_select').val();
    let state = $(this).val();
    let cityHtml:string = '';
    g_areaList.forEach((area, index)=>{
        if(country === area.id){
            for (let i = 0; i < area.states.length; i++) {
                const element = area.states[i];
                if(state === element.id){
                    for (let k = 0; k < element.cities.length; k++) {
                        const city = element.cities[k];
                        cityHtml += `<option value="${city.id}">${LANGUAGESTYPE == 'zh'?city.cname:city.name}</option>`;
                    }
                }
            }
        }
    })
    $('#city_select').html(cityHtml);
})

function lenghtstr(str:string){
    var realLength = 0, len = str.length, charCode = -1;
    for (var i = 0; i < len; i++) {
        charCode = str.charCodeAt(i);
        if (charCode >= 0 && charCode <= 128)
            realLength += 1;
        else
            realLength += 2;
    }
    return realLength;
}

let buildDid = new BuildDid();
buildDid.getStatus();
buildDid.getAreaList();

function TimesFormate(date:number){
     var days=Math.floor(date/(24*3600*1000));
     var leave1=date%(24*3600*1000);
     var hours=Math.floor(leave1/(3600*1000));
     var leave2=leave1%(3600*1000) ;
     var minutes=Math.floor(leave2/(60*1000));
     var leave3=leave2%(60*1000) ;
     var seconds=Math.round(leave3/1000);
     if(days > 0){
         return days+"days "+hours+"hours "+minutes+" mins"+seconds+" s";
     }else{
         if(hours > 0){
             return hours+"hours "+minutes+" mins"+seconds+" s";
         }else{
             if(minutes>0){
                 return minutes+" mins"+seconds+" s";
             }else{
                 return seconds+" s";
             }
         }
     }
}

async function initData(){
    if(g_token){
        gtag('event', 'build_did_pv_2_show_area', {
            'gtagTime': formatDate(new Date())
        });
        let currentTime = g_buyOodAfterTime = (new Date()).getTime();
        let visitTimeStorage = localStorage.getItem('cyfs-build-did-buy-ood-time');
        if(visitTimeStorage){
            let visitTime = Number(visitTimeStorage);
            let timeDiff = currentTime - visitTime;
            gtag('event', 'diff_build_did_1_buy_ood', {
                'diffTimeFormate': TimesFormate(timeDiff),
                'diffSenconds': Math.round(timeDiff/1000),
                'gtagTime': formatDate(new Date())
            });
        }
        buildDid.RenderArea();
        $('.create_did_step_one_box').css('display', 'none');
        $('.create_did_step_two_box, .create_did_step_two, .did_title_intro_btn_did').css('display', 'block');
        if(g_ip){
            buildDid.getUniqueId(g_ip);
        }else{
            for (let index = 0; index < g_ipArr.length; index++) {
                const ip = g_ipArr[index];
                if(!g_ip){
                    let isIpCanUse:boolean = false;
                    let ipCanUse:string = '';
                    let ipSplitArr:string[] = ip.split(':');
                    if((ipSplitArr.length == 1) || (ipSplitArr.length == 2 && ipSplitArr[1] == '')){
                        ipCanUse = ipSplitArr[0] + ':1320';
                        isIpCanUse = await buildDid.getUniqueId(ipCanUse);
                    }else{
                        ipCanUse = ip;
                        isIpCanUse = await buildDid.getUniqueId(ip);
                    }
                    console.log('isIpCanUse', isIpCanUse);
                    if(isIpCanUse){
                        g_ip = ipCanUse;
                    }
                }
            }
        }
        console.log('---g_ip', g_ip);
    }else{
        $('.did_title_intro_btn_vood').css('display', 'block');
        gtag('event', 'build_did_pv_1_first_visit', {
            'gtagTime': formatDate(new Date())
        });
    }
}
initData();

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_no', function () {
    $('.cover_box').css('display', 'none');
})

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_yes', function () {
    $('.cover_box, .did_mnemonic_create, .did_title_intro_btn').css('display', 'none');
    $('.did_mnemonic_choose').css('display', 'block');
    let mnemonicHtml:string = '';
    g_mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_choose_mnemonic_container').html(mnemonicHtml);
    gtag('event', 'build_did_pv_4_choose_mnemonics', {
        'gtagTime': formatDate(new Date())
    });
})

$('.create_did_container').on('click', '.did_next_btn', function () {
    let last = $(this).attr('data-last');
    let next = $(this).attr('data-next');
    if(last){
        $(''+last).css('display', 'none');
    }
    if(next){
        $(''+next).css('display', 'block');
    }
})

$('.did_buy_ood_btn').on('click', async function () {
    localStorage.removeItem('is-reset-did');
    gtag('event', 'click_build_did_1_buy_ood', {
        'gtagTime': formatDate(new Date())
    });
    
    localStorage.setItem('cyfs-build-did-buy-ood-time', String((new Date()).getTime()));
    window.location.href = 'https://vfoggie.fogworks.io/?url=cyfs://static/build_did.html&desc=#/login';
})

$('.create_did_container').on('click', '.create_mnemonic_btn', async function () {
    let didName = String($('.did_info_name').val()).trim() || '';
    let oodName = String($('.did_info_ood_name').val()).trim() || '';
    if(!didName || !oodName){
        toast({
            message: 'The information is not completed.',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    if(didName && lenghtstr(didName) > 16){
        toast({
            message: 'Nickname cannot exceed 16 characters.',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    g_didName = didName;
    g_oodName = oodName;
    g_country = Number($('#country_select').val());
    if(!g_country){
        toast({
            message: 'Please choose Country.',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    g_state = Number($('#state_select').val()) || 0;
    g_city = Number($('#city_select').val()) || 0;
    $('.create_did_step_two, .did_title_intro_btn_did').css('display', 'none');
    gtag('event', 'build_did_pv_3_show_mnemonics', {
        'gtagTime': formatDate(new Date())
    });
    $('.did_mnemonic_create_box, .did_title_intro_btn_phrase').css('display', 'block');
    let mnemonicList:string[] = await buildDid.createMnemonic();
    let mnemonicHtml:string = '';
    mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_create_mnemonic_box_show').html(mnemonicHtml);
    g_mnemonicList = mnemonicList.sort(function(a,b){ return Math.random()>.5 ? -1 : 1;});
})

$('.did_choose_mnemonic_container').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html() }</span>`;
    $('.did_choose_mnemonic_box').append(mnemonicHtml);
    if($('.did_choose_mnemonic_container').html() == ''){
        $('.did_verify_btn').removeAttr('disabled');
    }
})

$('.did_choose_mnemonic_box').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html()}</span>`;
    $('.did_choose_mnemonic_container').append(mnemonicHtml);
    if($('.did_choose_mnemonic_container').html() != ''){
        $('.did_verify_btn').attr('disabled', 'disabled');
    }
})

function _hashCode(strValue: string): number {
    let hash = 0;
    for (let i = 0; i < strValue.length; i++) {
        let chr = strValue.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }

    hash = Math.floor(Math.abs(hash) / 63336);

    return hash;
}


function _calcIndex(uniqueStr: string): number {

    // 示例用了cyfs sdk依赖的node-forge库进行计算
    const md5 = cyfs.forge.md.md5.create();
    md5.update(uniqueStr, 'utf8')
    let result = cyfs.forge.util.binary.hex.encode(md5.digest())
    let index = _hashCode(result);

    console.log(`calc init index: uniqueStr=${uniqueStr}, index=${index}`);

    return index
}


$('.did_verify_btn').on('click', async function () {
    $('.did_loading_cover_title').html('Loading......');
    $('.did_loading_cover_container').css('display', 'block');
    gtag('event', 'click_build_did_2_vertify', {
        'gtagTime': formatDate(new Date())
    });
    let mnemonic_Container = $('.did_choose_mnemonic_container').html();
    if(mnemonic_Container){
        $('.cover_box').css('display', 'none');
        toast({
            message: 'There is no choice for mnemonics',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    let mnemonicString = $('.did_choose_mnemonic_box').html();
    var reg = new RegExp("<span>","g");
    var reg2 = new RegExp("</span>","g");
    let mnemonicStr = mnemonicString.replace(reg,"").replace(reg2," ").slice(0, -1);
    if(g_mnemonicStr != mnemonicStr){
        $('.cover_box').css('display', 'none');
        toast({
            message: 'Recovery Phrase Validation Error',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    let peopleInfo = {
        area: new cyfs.Area(0 , 0, 0, 0),
        mnemonic: mnemonicStr,
        network: cyfs.get_current_network(),
        address_index: 0,
        name: g_didName,
        icon:undefined
    }
    let peopleRet = await buildDid.createPeople(peopleInfo);
    if(!peopleRet.err){
        g_peopleInfo = peopleRet;
        let deviceInfo = {
            unique_id: g_uniqueId,
            owner: g_peopleInfo.object.calculate_id(),
            owner_private: g_peopleInfo.privateKey,
            area: new cyfs.Area(g_country % 512 , 0, g_city % 8192,  0),
            network: cyfs.get_current_network(),
            address_index: _calcIndex(g_uniqueId),
            account: 0,
            nick_name: g_oodName,
            category: cyfs.DeviceCategory.OOD
        };
        let deviceRet = await buildDid.createDevice(deviceInfo);
        if(deviceRet.err){
            toast({
                message: 'create device failed',
                time: 3000,
                type: 'warn'
            });
        }else{
            g_deviceInfo = deviceRet;
            let pushOodList = g_peopleInfo.object.body_expect().content().ood_list.push(g_deviceInfo.device.device_id());
            let sign_ret = cyfs.sign_and_set_named_object(g_peopleInfo.privateKey, g_peopleInfo.object, new cyfs.SignatureRefIndex(255));
            if (sign_ret.err) {
                $('.cover_box').css('display', 'none');
                toast({
                    message: 'create device failed',
                    time: 3000,
                    type: 'warn'
                });
                return ;
            }
            $('.did_mnemonic_choose').css('display', 'none');
            $('.did_create_success').css('display', 'block');
            gtag('event', 'build_did_pv_5_activate', {
                'gtagTime': formatDate(new Date())
            });
        }
    }else{
        toast({
            message: 'Failed to create people',
            time: 3000,
            type: 'warn'
        });
    }
    $('.cover_box').css('display', 'none');
})

function countDown () {
    setTimeout(() => {
        if(g_countDown > 0){
            $('.did_bind_success_subtitle_i').html(String(g_countDown - 1));
            g_countDown--;
            countDown();
        }else{
            window.location.href = 'cyfs://static/browser.html?success';
        }
    }, 1000);
}

$('.did_success_next_btn').on('click', async function () {
    $('.did_loading_cover_title').html('Activating, please do not operate.');
    $('.did_loading_cover_container').css('display', 'block');
    gtag('event', 'click_build_did_3_activate', {
        'gtagTime': formatDate(new Date())
    });
    let peopleUpChainR = await buildDid.upChain(g_peopleInfo.object);
    if(!peopleUpChainR){
        $('.cover_box, .did_loading_cover_container').css('display', 'none');
        toast({
            message: 'people up chain failed',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    let oodUpChainR = await buildDid.upChain(g_deviceInfo.device);
    if(!oodUpChainR){
        $('.cover_box, .did_loading_cover_container').css('display', 'none');
        toast({
            message: 'ood up chain failed',
            time: 3000,
            type: 'warn'
        });
        return;
    }
    let index = _calcIndex(g_uniqueId);
    let bindInfo = {
        owner: g_peopleInfo.object.to_hex().unwrap(),
        desc: g_deviceInfo.device.to_hex().unwrap(),
        sec: g_deviceInfo.privateKey.to_vec().unwrap().toHex(),
        index
    }
    try{
        const activeteResponse = await fetch(`http://${g_ip}/activate?access_token=${g_token}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }, body: JSON.stringify(bindInfo),
        });
        const activeteRet = await activeteResponse.json();
        if (activeteRet.result != 0) {
            $('.cover_box').css('display', 'none');
            toast({
                message: 'Activete ood failed',
                time: 3000,
                type: 'warn'
            });
            return;
        }
    }catch{
        toast({
            message: 'Activete ood failed',
            time: 3000,
            type: 'warn'
        });
        $('.cover_box').css('display', 'none');
        return;
    }
    const deviceInfo = await (await fetch('http://127.0.0.1:1321/check')).json();
    const runtimecreateInfo = {
        unique_id: deviceInfo.device_info.mac_address,
        owner: g_peopleInfo.objectId,
        owner_private: g_peopleInfo.privateKey,
        area: new cyfs.Area(0 ,0, 0, 0),
        network: cyfs.get_current_network(),
        address_index: _calcIndex(deviceInfo.device_info.mac_address),
        account: 0,
        nick_name: 'runtime',
        category: cyfs.DeviceCategory.PC
    };
    const runtimeInfo = await buildDid.createDevice(runtimecreateInfo);
    if(!runtimeInfo.err){
        let index = _calcIndex(deviceInfo.device_info.mac_address);
        let bindDeviceInfo = {
            owner: g_peopleInfo.object.to_hex().unwrap(),
            desc: runtimeInfo.device.to_hex().unwrap(),
            sec: runtimeInfo.privateKey.to_vec().unwrap().toHex(),
            index
        }
        try{
            const response = await fetch("http://127.0.0.1:1321/bind", {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                }, body: JSON.stringify(bindDeviceInfo),
            });
            const ret = await response.json();
            if (ret.result != 0) {
                if(ret.result == 5){
                    toast({
                        message: 'browser is activated.',
                        time: 3000,
                        type: 'warn'
                    });
                    window.location.href = 'cyfs://static/browser.html';
                }else{
                    toast({
                        message: 'Activate runtime failed,' + ret.msg,
                        time: 3000,
                        type: 'warn'
                    });
                    return;
                }
            }
        }catch{
            toast({
                message: 'Activate runtime failed',
                time: 3000,
                type: 'warn'
            });
            $('.cover_box').css('display', 'none');
            return;
        }
        $('.create_did_step_two_box').css('display', 'none');
        $('.create_did_step_three_box').css('display', 'block');
        gtag('event', 'build_did_pv_6_activatee_success', {
            'gtagTime': formatDate(new Date())
        });
        let currentTime = (new Date()).getTime();
        let visitTimeStorage = localStorage.getItem('cyfs-build-did-buy-ood-time');
        if(visitTimeStorage){
            let visitTime = Number(visitTimeStorage);
            let timeDiff = currentTime - visitTime;
            gtag('event', 'diff_build_did_2_activete_process', {
                'diffTimeFormate': TimesFormate(timeDiff),
                'diffSenconds': Math.round(timeDiff/1000),
                'gtagTime': formatDate(new Date())
            });
        }
        let timeDiff2 = currentTime - g_buyOodAfterTime;
        gtag('event', 'diff_build_did_3_buy_after_activate', {
            'diffTimeFormate': TimesFormate(timeDiff2),
            'diffSenconds': Math.round(timeDiff2/1000),
            'gtagTime': formatDate(new Date())
        });
        countDown();
    }
    $('.cover_box').css('display', 'none');
})

$('.did_intro_container').on('click', '.did_intro_close_i', function () {
    $('.did_introduce_cover_container, .did_intro_container').css('display', 'none');
})

$('.did_title_intro_btn').on('click', function () {
    let box = $(this).attr('data-box');
    if(box){
        $('.did_introduce_cover_container, .'+box).css('display', 'block');
    }
})
