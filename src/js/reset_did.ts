import $ from 'jquery';
import * as cyfs from '../cyfs_sdk/cyfs'
let QRCode = require('qrcode')
import { toast } from './lib/toast.min'
import { ObjectUtil, formatDate, LANGUAGESTYPE, castToLocalUnit } from './lib/util'

$(async function(){
    if(LANGUAGESTYPE == 'zh'){
        $('title').html('重置DID');
    }else{
        $('title').html('Reset DID');
    }
});

let g_mnemonic:string = '';
let g_ip:string = '';
let g_token:string = '';
let g_uniqueId:string = '';
let g_countDown:number = 3;
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
let g_peopleOnMeta: cyfs.People | undefined;
let g_peopleId: string;
let g_activation:boolean = false;

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
        }
    }
}

// header render
ObjectUtil.renderHeaderInfo();

class ResetDid {
    meta_client: cyfs.MetaClient;

    constructor() {
        this.meta_client = cyfs.create_meta_client();
    }

    async getPeoplePrivateKey (mnemonic:string, network: cyfs.CyfsChainNetwork, address_index: number) {
        let gen = cyfs.CyfsSeedKeyBip.from_mnemonic(mnemonic);
        if (gen.err) {
            return gen;
        }
        let path = cyfs.CyfsChainBipPath.new_people(network, address_index);
        let private_key_r = gen.unwrap().sub_key(path);
        return [private_key_r, path];
    }

    async createPeople(info: {area: cyfs.Area,mnemonic: string,network: cyfs.CyfsChainNetwork,address_index: number,name?: string,icon?: cyfs.FileId}){
        let [private_key_r, path] = await this.getPeoplePrivateKey(info.mnemonic, info.network, info.address_index);
        if (private_key_r.err) {
            return private_key_r;
        }
        let private_key = private_key_r.unwrap();
        let people = cyfs.People.create(cyfs.None, [], private_key.public(), cyfs.Some(info.area), info.name, info.icon, (build) => {
            build.no_create_time()
        });
        let people_id = people.desc().calculate_id();
        return {
            objectId: people_id,
            object: people,
            privateKey: private_key,
            path: path.to_string()
        };
    }

    async check_people_on_meta(people_id: cyfs.ObjectId): Promise<cyfs.People | undefined> {
        let people: cyfs.People | undefined = undefined, is_bind = false
        const people_r = await this.meta_client.getDesc(people_id);
        console.origin.log('-----people_r', people_r);
        if (people_r.ok) {
            console.origin.log('-----people_r.unwrap()', people_r.unwrap());
            people_r.unwrap().match({
                People: (p: cyfs.People) => {
                    // is_bind = p.body_expect().content().ood_list.length > 0;
                    people = p;
                    return people;
                }
            })
        }
        return people;
        // return [people, is_bind]
    }

    async getDevicePrivateKey (owner_private: cyfs.PrivateKey, owner: cyfs.ObjectId, account: number, network: cyfs.CyfsChainNetwork, address_index: number) {
        let gen = cyfs.CyfsSeedKeyBip.from_private_key(owner_private.to_vec().unwrap().toHex(), owner.to_base_58());
        let path = cyfs.CyfsChainBipPath.new_device(account, network, address_index);
        let private_key_r = gen.unwrap().sub_key(path);
        return private_key_r;
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
        let private_key_r = await this.getDevicePrivateKey(info.owner_private, info.owner, info.account, info.network, info.address_index);
        if (private_key_r.err) {
            return private_key_r;
        }
        let private_key = private_key_r.unwrap();

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
        let sign_ret = cyfs.sign_and_set_named_object(info.owner_private, device, new cyfs.SignatureRefIndex(254))
        if (sign_ret.err) {
            toast({
                message: 'create device failed',
                time: 3000,
                type: 'warn'
            });
            return ;
        }
        return {
            deviceId: device_id,
            device: device,
            privateKey: private_key
        }
    }

    async getUniqueId (ip:string) {
        try{
            $.ajax({
                url: `http://${ip}/check?access_token=${g_token}`,
                success: async function(data){
                    let result = JSON.parse(data);
                    g_uniqueId = String(result.device_info.mac_address);
                    if (result.activation) {
                        console.log(ip+'check-result', result);
                        g_peopleId = String(result.bind_info.owner_id || '');
                        $('.activated_title_id').html('DID ：' + g_peopleId);
                        // $('.recovery_phrase_choose_box').css('display', 'none');
                        $('.recovery_phrase_title').css('display', 'block');
                        // $('.reset_did_step_one_box, .activated_title').css('display', 'block');
                        g_activation = true;
                    } else {
                        $('.haved_did_click').css('display', 'block');
                    }
                }
            })
        }catch{
            $('.reset_did_step_two_box, .recovery_phrase_title').css('display', 'none');
            $('.reset_did_step_one_box, .activated_title').css('display', 'block');
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
        await _sleep(interval);
        let hasReturnRet:boolean = false;
        while (waitTime < checkTimeoutSecs * 1000 && !hasReturnRet) {
            const ret = await this.transformBuckyResult(await this.meta_client.getReceipt(txId));
            console.origin.log('get receipt:', txId, ret);
            if (ret.code == 0 && ret.value.is_some()) {
                const [receipt, _] = ret.value.unwrap();
                console.origin.log('update desc receipt:', txId.to_base_58(), receipt.result);
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

    async upChain (id:cyfs.ObjectId, obj: cyfs.AnyNamedObject) {
        // getDesc upchain
        let check_p_ret = await this.check_people_on_meta(id);
        console.origin.log('check_p_ret', check_p_ret);
        let p_tx:cyfs.TxId;
        if(check_p_ret){
            let p_ret = await this.meta_client.update_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(obj).unwrap(), cyfs.None, cyfs.None, g_peopleInfo.privateKey);
            console.origin.log('p_ret', p_ret)
            p_tx = p_ret.unwrap();
        }else{
            let p_ret = await this.meta_client.create_desc(g_peopleInfo.object, cyfs.SavedMetaObject.try_from(obj).unwrap(), cyfs.JSBI.BigInt(0), 0, 0, g_peopleInfo.privateKey);
            console.origin.log('p_ret', p_ret)
            p_tx = p_ret.unwrap();
        }
        // check upchain
        let p_meta_success = await this.checkReceipt(p_tx)
        console.log('people desc on meta:', p_meta_success);
        return p_meta_success;
    }
}

let resetDid = new ResetDid();
if(g_token && g_ip){
    let checkIp = g_ip.replace("[","").replace("]","");
    console.log('------checkIp',checkIp)
    if(checkIp.indexOf(':') < 0){
        checkIp = checkIp + ':1320';
    }
    $('.reset_did_step_one_box').css('display', 'block');
    $('.reset_did_step_two_box').css('display', 'none');
    resetDid.getUniqueId(checkIp);
}else{
    $('.reset_did_step_one_box, .haved_did_click').css('display', 'none');
    $('.reset_did_step_two_box').css('display', 'block');
}

function copyData (data:string) {
    $('#copy_textarea').text(data).show();
    $('#copy_textarea').select();
    document.execCommand('copy', false, '');
    $('#copy_textarea').hide();
    toast({
        message: LANGUAGESTYPE == 'zh'?"复制成功":'Copied successfully',
        time: 3000,
        type: 'success'
    });
}

$('.info_main_copy_svg').on('click', async function () {
    copyData(g_peopleId || '');
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

function str2array(str: string): Uint8Array {
    let out = new Uint8Array(str.length);
    for(let i = 0; i < str.length; ++i) {
        out[i] = str.charCodeAt(i);
    }
    return out;
}

$('.app_header_box').on('click', '.people_head_sculpture', async function () {
    window.location.href = 'cyfs://static/info.html';
})


async function bindOod () {
    let index = _calcIndex(g_uniqueId);
    let bindInfo = {
        owner: g_peopleInfo.object.to_hex().unwrap(),
        desc: g_deviceInfo.device.to_hex().unwrap(),
        sec: g_deviceInfo.privateKey.to_vec().unwrap().toHex(),
        index
    }
    console.origin.log("bindInfo:", bindInfo);
    let checkIp = g_ip.replace("[","").replace("]","");
    try{
        const activeteResponse = await fetch(`http://${checkIp}/activate?access_token=${g_token}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }, body: JSON.stringify(bindInfo),
        });
        const activeteRet = await activeteResponse.json();
        if (activeteRet.result !== 0) {
            toast({
                message: 'Activete ood failed',
                time: 3000,
                type: 'warn'
            });
            return false;
        }
        return true;
    }catch{
        return false;
    }
}

async function bindRuntime () {
    const deviceInfo = await (await fetch('http://127.0.0.1:1321/check')).json();
    console.origin.log("deviceInfo:", deviceInfo)
    const runtimeInfo = await resetDid.createDevice({
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
    let index = _calcIndex(deviceInfo.device_info.mac_address);
    console.origin.log("peopleOnMeta:", g_peopleOnMeta);
    let bindDeviceInfo = {
        owner: g_peopleOnMeta?.to_hex().unwrap() || g_peopleInfo.object.to_hex().unwrap(),
        desc: runtimeInfo.device.to_hex().unwrap(),
        sec: runtimeInfo.privateKey.to_vec().unwrap().toHex(),
        index
    }
    console.origin.log('bindDeviceInfo', bindDeviceInfo)
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
            toast({
                message: 'Binding runtime failed,' + ret.msg,
                time: 3000,
                type: 'warn'
            });
        } else {
            if(g_activation || !g_peopleId){
                $('.reset_did_activate_ood_title').html('Your DID has been reset successfully');
            }else{
                $('.reset_did_activate_ood_title').html('VOOD binding successfully');
            }
            $('.reset_did_step_one_box, .reset_did_activate_ood').css('display', 'none');
            $('.reset_did_ood_bind').css('display', 'block');
            countDown();
        }
    }catch{
        toast({
            message: 'Binding runtime failed',
            time: 3000,
            type: 'warn'
        });
        $('.did_loading_cover_container').css('display', 'none');
    }
}

$('.did_verify_btn').on('click', async function () {
    $('.did_loading_cover_container').css('display', 'block');
    g_mnemonic = String($('.recovery_phrase_textarea').val());
    let mnemonicR = cyfs.bip39.validateMnemonic(g_mnemonic);
    console.origin.log("gen mnemonicR:", mnemonicR);
    if(!mnemonicR){
        toast({
            message: 'Recovery Phrase Validation Error',
            time: 3000,
            type: 'warn'
        });
    }else{
        let peopleInfo = {
            area: new cyfs.Area(0 ,0,0,0),
            mnemonic: g_mnemonic,
            network: cyfs.get_current_network(),
            address_index: 0,
            name: '',
            icon:undefined
        }
        let peopleRet = await resetDid.createPeople(peopleInfo);
        console.origin.log("peopleRet:", peopleRet, peopleRet.objectId.to_base_58());
        if(peopleRet.err){
            toast({
                message: 'Failed to create people',
                time: 3000,
                type: 'warn'
            });
        }else{
            g_peopleInfo = peopleRet;
            if(g_peopleId && (peopleRet.objectId.to_base_58() != g_peopleId)){
                toast({
                    message: `The recovery phrase you entered does not match the DID (${g_peopleId}).`,
                    time: 3000,
                    type: 'warn'
                });
                $('.recovery_phrase_textarea').val('');
                $('.reset_did_step_one_box, .recovery_phrase_title').css('display', 'none');
                $('.reset_did_step_one_box, .activated_title').css('display', 'block');
            }else{
                let peopleOnMeta = g_peopleOnMeta = await resetDid.check_people_on_meta(peopleRet.objectId);
                if(g_token && g_ip && !g_activation){
                    let oodList = g_peopleInfo.object.body_expect().content().ood_list;
                    if((oodList.length >= 1) || (peopleOnMeta && peopleOnMeta.body().unwrap().content().ood_list.length >= 1)){
                        toast({
                            message: 'You have multiple VOODs, the browser does not currently support multiple OOD modes.',
                            time: 3000,
                            type: 'warn'
                        });
                    }else{
                        let deviceInfo = {
                            unique_id: g_uniqueId,
                            owner: peopleRet.objectId,
                            owner_private: peopleRet.privateKey,
                            area: new cyfs.Area(0 , 0, 0, 0),
                            network: cyfs.get_current_network(),
                            address_index: _calcIndex(g_uniqueId),
                            account: 0,
                            nick_name: '',
                            category: cyfs.DeviceCategory.OOD
                        };
                        console.origin.log("deviceInfo:", deviceInfo);
                        let deviceRet = await resetDid.createDevice(deviceInfo);
                        console.origin.log("deviceRet:", deviceRet);
                        if(deviceRet.err){
                            toast({
                                message: 'create device failed',
                                time: 3000,
                                type: 'warn'
                            });
                        }else{
                            g_deviceInfo = deviceRet;
                            let pushOodList = g_peopleInfo.object.body_expect().content().ood_list.push(deviceRet.deviceId);
                            let sign_ret = cyfs.sign_and_set_named_object(g_peopleInfo.privateKey, g_peopleInfo.object, new cyfs.SignatureRefIndex(255));
                            if (sign_ret.err) {
                                toast({
                                    message: 'create device failed',
                                    time: 3000,
                                    type: 'warn'
                                });
                            }else{
                                $('.did_loading_cover_container, .reset_did_step_one_box').css('display', 'none');
                                $('.reset_did_activate_ood').css('display', 'block');
                            }
                        }
                    }
                }else{
                    if((!peopleOnMeta && g_peopleInfo.object.body_expect().content().ood_list.length < 1) || (peopleOnMeta && peopleOnMeta.body().unwrap().content().ood_list.length < 1)){
                        toast({
                            message: 'ood list is empty',
                            time: 3000,
                            type: 'warn'
                        });
                        $('.reset_did_step_one_box').css('display', 'none');
                        $('.reset_did_step_two_box').css('display', 'block');
                    }
                    console.origin.log("peopleRet-ood_list:", peopleRet.object.body().unwrap().content().ood_list);
                    console.origin.log("peopleOnMeta-ood_list:", peopleOnMeta?.body().unwrap().content().ood_list);
                    await bindRuntime();
                }
            }
        }
    }
    $('.did_loading_cover_container').css('display', 'none');
})

$('.activate_vood_btn').on('click', async function () {
    $('.did_loading_cover_container').css('display', 'block');
    let peopleUpRet = await resetDid.upChain(g_peopleInfo.objectId, g_peopleInfo.object);
    if(peopleUpRet){
        let deviceUpRet = await resetDid.upChain(g_deviceInfo.deviceId, g_deviceInfo.device);
        if(deviceUpRet){
            let bindOodRet = await bindOod();
            if(bindOodRet){
                await bindRuntime();
            }
        }else{
            toast({
                message: 'ood up chain failed',
                time: 3000,
                type: 'warn'
            });
        }
    }else{
        toast({
            message: 'people up chain failed',
            time: 3000,
            type: 'warn'
        });
    }
    $('.did_loading_cover_container').css('display', 'none');
})

$('.reset_did_step_one_box .haved_did_click').on('click', async function () {
    sessionStorage.removeItem('is-reset-did');
    window.location.href = `cyfs://static/build_did.html?action=bindVood&ip=${g_ip}&accessToken=${g_token}`;
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

$('.choose_ood_btn').on('click', function () {
    $('.reset_did_step_two_box').css('display', 'none');
    $('.reset_did_step_one_box').css('display', 'block');
})

$('.reset_ood_btn').on('click', function () {
    sessionStorage.setItem('is-reset-did', 'true');
    window.location.href = 'https://vfoggie.fogworks.io/?url=cyfs://static/reset_did.html&desc=#/login';
})

$('.recovery_phrase_textarea').on('keyup', function () {
    g_mnemonic = String($('.recovery_phrase_textarea').val());
    let mnemonicR = cyfs.bip39.validateMnemonic(g_mnemonic);
    console.origin.log("gen mnemonicR:", mnemonicR);
    if(mnemonicR){
        $('.did_verify_btn').removeAttr('disabled');
    }else{
        $('.did_verify_btn').attr('disabled', 'disabled');
    }
})

$('.did_title_intro_btn').on('click', function () {
    let box = $(this).attr('data-box');
    if(box){
        $('.'+box).css('display', 'block');
    }
})

$('.did_intro_container').on('click', '.did_intro_close_i', function () {
    $('.did_intro_container').css('display', 'none');
})
