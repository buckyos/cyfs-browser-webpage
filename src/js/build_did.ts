import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from './lib/util'
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
    deviceId: cyfs.ObjectId,
    device: cyfs.Device,
    privateKey: cyfs.PrivateKey,
};
let g_uniqueId:string = '';
let g_countDown:number = 3;
let g_isResetDid:boolean = false;
console.origin.log('window', window)
if (window.location.search.split("?")[1]) {
    let str = window.location.search.split("?")[1];
    let arr = str.split('&');
    if (arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'accessToken') {
                g_token = arr[i].split('=')[1];
            }
            if (arr[i].indexOf('=') > -1 && arr[i].split('=')[1] && arr[i].split('=')[0] == 'ip') {
                g_ip = arr[i].split('=')[1];
            }
            let isResetDid = sessionStorage.getItem('is-reset-did');
            console.log('')
            if(isResetDid == 'true'){
                g_isResetDid = true;
                window.location.href = `cyfs://static/reset_did.html?action=bindVood&ip=${g_ip}&accessToken=${g_token}`;
            }else{
                $('.create_did_container, .create_did_step_one_box').css('display', 'block');
            }
        }
    }
}

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('创建DID');
    }else{
        $('title').html('Build DID');
    }
});

window.dataLayer = window.dataLayer || [];
function gtag(){
    dataLayer.push(arguments);
    console.log('dataLayer:', dataLayer)
}
gtag('js', new Date());
gtag('config', 'G-3F1C521DHQ');

// header render
ObjectUtil.renderHeaderInfo();

$('.app_header_box').on('click', '.people_head_sculpture', function () {
    window.location.href = 'cyfs://static/info.html';
})

class BuildDid {
    meta_client: cyfs.MetaClient;
    constructor() {
        this.meta_client = cyfs.create_meta_client();
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
        console.origin.log("g_areaList:", g_areaList);
    }

    async RenderArea () {
        if(!g_areaList.length){
            setTimeout(() => {
                this.RenderArea();
            }, 500);
            return;
        }
        let countryHtml:string = '';
        let stateHtml:string = '';
        let cityHtml:string = '';
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
        let people_id = people.desc().calculate_id();
        let sign_ret = cyfs.sign_and_set_named_object(private_key, people, new cyfs.SignatureRefIndex(0));
        if (sign_ret.err) {
            return sign_ret;
        }
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
        let device_id = device.desc().calculate_id();
        console.log("create_device", device_id.to_base_58());
        let sign_ret = cyfs.sign_and_set_named_object(info.owner_private, device, new cyfs.SignatureRefIndex(0))
        if (sign_ret.err) {
            return sign_ret;
        }
        return {
            deviceId: device_id,
            device: device,
            privateKey: private_key
        }
    }

    async getUniqueId (ip:string) {
        $.ajax({
            url: `http://${ip}/check?access_token=${g_token}`,
            success:function(data){
                let result = JSON.parse(data);
                if (!result.activation) {
                    console.log(ip+'check-result', result);
                    g_uniqueId = String(result.device_info.mac_address);
                } else {
                    window.location.href = `cyfs://static/reset_did.html?action=bindVood&ip=[${ip}]&accessToken=${g_token}`;
                }
            }
        })
    }

    async checkReceipt(client: cyfs.MetaClient, txId: cyfs.TxId): Promise<boolean> {
        const _sleep = (ms: number) => {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }
        let beforeDate = new Date; 
        while(true) {
            await _sleep(3000)
            let currentDate = new Date; 
            if (currentDate.getTime() > beforeDate.getTime() + 3000){
                return false;
            }
            let ret = await client.getReceipt(txId)
            // 失败，表示tx还没有上链，等一段时间再查
            if (ret.ok && ret.unwrap().is_some()) {
                let [receipt, blocknumber] = ret.unwrap().unwrap()
                // receipt.result为0，表示上链成功。result不为0，表示交易上链，但是执行失败，失败错误码为result
                return receipt.result === 0
            }
        }
    }

    async upChain () {
        let p_ret = await this.meta_client.create_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(g_peopleInfo.object).unwrap(), cyfs.JSBI.BigInt(0), 0, 0, g_peopleInfo.privateKey);
        let p_tx = p_ret.unwrap();
        let p_meta_success = await this.checkReceipt(this.meta_client, p_tx)
        console.log('people desc on meta:', p_meta_success);
        let o_ret = await this.meta_client.create_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(g_deviceInfo.device).unwrap(), cyfs.JSBI.BigInt(0), 0, 0, g_peopleInfo.privateKey);
        // 如果o_ret不报错，等待交易上链
        let o_tx = o_ret.unwrap()
        // 现在只有定期查询的接口
        let o_meta_success = await this.checkReceipt(this.meta_client, o_tx)
        console.log('ood desc on meta:', o_meta_success)
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
    let country = $(this).val();
    let stateHtml:string = '';
    let cityHtml:string = '';
    g_areaList.forEach((area, index)=>{
        if(country === area.id){
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
buildDid.getAreaList();

function DaysFormate(date:number){
    //计算出相差天数
    var days=Math.floor(date/(24*3600*1000));
    //计算出小时数
    var leave1=date%(24*3600*1000);    //计算天数后剩余的毫秒数
    var hours=Math.floor(leave1/(3600*1000));
    //计算相差分钟数
    var leave2=leave1%(3600*1000) ;       //计算小时数后剩余的毫秒数
    var minutes=Math.floor(leave2/(60*1000));
    //计算相差秒数
    var leave3=leave2%(60*1000) ;     //计算分钟数后剩余的毫秒数
    var seconds=Math.round(leave3/1000);
    if(days > 0){
        return days+"天 "+hours+"小时 "+minutes+" 分钟"+seconds+" 秒";
    }else{
        if(hours > 0){
            return hours+"小时 "+minutes+" 分钟"+seconds+" 秒";
        }else{
            if(minutes>0){
                return minutes+" 分钟"+seconds+" 秒";
            }else{
                return seconds+" 秒";
            }
        }
    }
}
    

if(g_token && g_ip){
    $('.create_did_step_one_box').css('display', 'none');
    $('.create_did_step_two_box, .create_did_step_two').css('display', 'block');
    let checkIp = g_ip.replace("[","").replace("]","");
    console.log('------checkIp',checkIp)
    buildDid.getUniqueId(checkIp);
    buildDid.RenderArea();
    gtag('event', 'cyfs_build_did_show_area', {
        'time': new Date()
    });
}else{
    gtag('event', 'cyfs_build_did_first_enter_page', {
        'time': new Date()
    });
    localStorage.setItem('cyfs-build-did-first-visit', String((new Date()).getTime()));
}

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_no', function () {
    $('.cover_box').css('display', 'none');
})

$('.cover_box').on('click', '.close_cover_i, .did_warn_btn_yes', function () {
    $('.cover_box, .did_mnemonic_create').css('display', 'none');
    $('.did_mnemonic_choose').css('display', 'block');
    let mnemonicHtml:string = '';
    g_mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_choose_mnemonic_container').html(mnemonicHtml);
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
    gtag('event', 'cyfs_build_did_buy_ood_click', {
        'time': new Date()
    });
    let currentTime = (new Date()).getTime();
    let visitTimeStorage = localStorage.getItem('cyfs-build-did-first-visit');
    if(visitTimeStorage){
        let visitTime = Number(visitTimeStorage);
        let timeDiff = currentTime - visitTime;
        gtag('event', 'cyfs_build_did_buy_ood_diff', {
            'time': DaysFormate(timeDiff)
        });
    }
    window.location.href = 'https://vfoggie.fogworks.io/?url=cyfs://static/build_did.html&desc=#/login';
})

$('.create_did_container').on('click', '.create_mnemonic_btn', async function () {
    let didName = String($('.did_info_name').val()).trim() || '';
    let oodName = String($('.did_info_ood_name').val()).trim() || '';
    console.origin.log('------didName, oodName',didName, oodName)
    if(!didName || !oodName){
        toast({
            message: LANGUAGESTYPE == 'zh'?"信息没有填写完成": 'The information is not completed.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    if(didName && lenghtstr(didName) > 16){
        toast({
            message: LANGUAGESTYPE == 'zh'?"名称不可以超过16个字符": 'Nickname cannot exceed 16 characters.',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    g_didName = didName;
    g_oodName = oodName;
    $('.create_did_step_two').css('display', 'none');
    $('.did_mnemonic_create_box').css('display', 'block');
    g_country = Number($('#country_select').val()) || 0;
    g_state = Number($('#state_select').val()) || 0;
    g_city = Number($('#city_select').val()) || 0;
    console.log("----g_country, g_state, g_city:", g_country, g_state, g_city);
    let mnemonicList:string[] = await buildDid.createMnemonic();
    let mnemonicHtml:string = '';
    mnemonicList.forEach(mnemonic=>{
        mnemonicHtml += `<span>${mnemonic}</span>`;
    });
    $('.did_create_mnemonic_box_show').html(mnemonicHtml);
    g_mnemonicList = mnemonicList.sort(function(a,b){ return Math.random()>.5 ? -1 : 1;});
    gtag('event', 'cyfs_build_did_choose_area_next', {
        'time': new Date()
    });
})

$('.did_choose_mnemonic_container').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html() }</span>`;
    $('.did_choose_mnemonic_box').append(mnemonicHtml);
})

$('.did_choose_mnemonic_box').on('click', 'span', function () {
    $(this).remove();
    let mnemonicHtml = `<span>${$(this).html()}</span>`;
    $('.did_choose_mnemonic_container').append(mnemonicHtml);
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
    $('.did_loading_cover_container').css('display', 'block');
    let mnemonic_Container = $('.did_choose_mnemonic_container').html();
    if(mnemonic_Container){
        $('.cover_box').css('display', 'none');
        toast({
            message: LANGUAGESTYPE == 'zh'?"还有助记词没有选择": 'There is no choice for mnemonics',
            time: 1500,
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
            time: 1500,
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
    console.origin.log("peopleInfo:", peopleInfo);
    let peopleRet = await buildDid.createPeople(peopleInfo);
    console.origin.log("peopleRet:", peopleRet);
    if(!peopleRet.err){
        g_peopleInfo = peopleRet;
        let deviceInfo = {
            unique_id: g_uniqueId,
            owner: g_peopleInfo.objectId,
            owner_private: g_peopleInfo.privateKey,
            area: new cyfs.Area(g_country ,g_state,g_city,0),
            network: cyfs.get_current_network(),
            address_index: _calcIndex(g_uniqueId),
            account: 0,
            nick_name: g_oodName,
            category: cyfs.DeviceCategory.OOD
        };
        console.origin.log("deviceInfo:", deviceInfo);
        let deviceRet = await buildDid.createDevice(deviceInfo);
        console.origin.log("deviceRet:", deviceRet);
        if(deviceRet.err){
            toast({
                message: 'create device failed',
                time: 1500,
                type: 'warn'
            });
        }else{
            g_deviceInfo = deviceRet;
            let pushOodList = g_peopleInfo.object.body_expect().content().ood_list.push(deviceRet.deviceId);
            let sign_ret = cyfs.sign_and_set_named_object(g_peopleInfo.privateKey, g_peopleInfo.object, new cyfs.SignatureRefIndex(0));
            if (sign_ret.err) {
                $('.cover_box').css('display', 'none');
                toast({
                    message: 'create device failed',
                    time: 1500,
                    type: 'warn'
                });
                return ;
            }
            $('.did_mnemonic_choose').css('display', 'none');
            $('.did_create_success').css('display', 'block');
        }
    }else{
        toast({
            message: LANGUAGESTYPE == 'zh'?"创建people失败": 'Failed to create people',
            time: 1500,
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
            // chrome.runtime.restart();
        }
    }, 1000);
}

$('.did_success_next_btn').on('click', async function () {
    $('.did_loading_cover_container').css('display', 'block');
    cyfs.sign_and_push_named_object(g_peopleInfo.privateKey, g_deviceInfo.device, new cyfs.SignatureRefIndex(254)).unwrap();
    await buildDid.upChain();
    let index = _calcIndex(g_uniqueId);
    let bindInfo = {
        owner: g_peopleInfo.object.to_hex().unwrap(),
        desc: g_deviceInfo.device.to_hex().unwrap(),
        sec: g_deviceInfo.privateKey.to_vec().unwrap().toHex(),
        index
    }
    console.origin.log("bindInfo:", bindInfo);
    let checkIp = g_ip.replace("[","").replace("]","");
    const activeteResponse = await fetch(`http://${checkIp}/activate?access_token=${g_token}`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        }, body: JSON.stringify(bindInfo),
    });
    const activeteRet = await activeteResponse.json();
    if (activeteRet.result !== 0) {
        $('.cover_box').css('display', 'none');
        toast({
            message: 'Activete ood failed',
            time: 1500,
            type: 'warn'
        });
        return;
    }else{
        const deviceInfo = await (await fetch('http://127.0.0.1:1321/check')).json();
        console.origin.log("deviceInfo:", deviceInfo)
        const runtimeInfo = await buildDid.createDevice({
            unique_id: `${deviceInfo.device_info.mac_address}`,
            owner: g_peopleInfo.objectId,
            owner_private: g_peopleInfo.privateKey,
            area: new cyfs.Area(0 ,0, 0, 0),
            network: cyfs.get_current_network(),
            address_index: 0,
            account: 0,
            nick_name: 'runtime',
            category: cyfs.DeviceCategory.PC
        });
        cyfs.sign_and_push_named_object(g_peopleInfo.privateKey, runtimeInfo.device, new cyfs.SignatureRefIndex(254)).unwrap();
        let deviceIndex = _calcIndex(deviceInfo.device_info.mac_address);
        let bindDeviceInfo = {
            owner: g_peopleInfo.object.to_hex().unwrap(),
            desc: runtimeInfo.device.to_hex().unwrap(),
            sec: runtimeInfo.privateKey.to_vec().unwrap().toHex(),
            deviceIndex
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
            if (ret.result !== 0) {
                toast({
                    message: 'Binding failed,' + ret.msg,
                    time: 1500,
                    type: 'warn'
                });
            } else {
                $('.create_did_step_two_box').css('display', 'none');
                $('.create_did_step_three_box').css('display', 'block');
                gtag('event', 'cyfs_build_did_activate_success', {
                    'time': new Date()
                });
                let currentTime = (new Date()).getTime();
                let visitTimeStorage = localStorage.getItem('cyfs-build-did-first-visit');
                if(visitTimeStorage){
                    let visitTime = Number(visitTimeStorage);
                    let timeDiff = currentTime - visitTime;
                    gtag('event', 'cyfs_build_did_activete_ood_diff', {
                        'time': DaysFormate(timeDiff)
                    });
                }
                countDown();
            }
        }catch{
            toast({
                message: 'Binding failed',
                time: 1500,
                type: 'warn'
            });
            $('.cover_box').css('display', 'none');
        }
    }
    $('.cover_box').css('display', 'none');
})
