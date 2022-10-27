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

ObjectUtil.renderHeaderInfo();

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
                    console.error(`local ood already binded`)
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

let resetDid = new ResetDid();
if(g_token && g_ip){
    let checkIp = g_ip.replace("[","").replace("]","");
    console.log('------checkIp',checkIp)
    resetDid.getUniqueId(checkIp);
    $('.reset_did_step_one_box').css('display', 'block');
    $('.reset_did_step_two_box').css('display', 'none');
}else{
    $('.reset_did_step_one_box').css('display', 'none');
    $('.reset_did_step_two_box').css('display', 'block');
}


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

$('.app_header_box').on('click', '.people_head_sculpture', function () {
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
            time: 1500,
            type: 'warn'
        });
        return;
    }else{
        const response = await fetch("http://127.0.0.1:1321/bind", {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }, body: JSON.stringify(bindInfo),
        });
        const ret = await response.json();
        if (ret.result !== 0) {
            toast({
                message: 'Binding failed,' + ret.msg,
                time: 1500,
                type: 'warn'
            });
        } else {
            $('.reset_did_step_one_box').css('display', 'none');
            $('.create_did_step_three_box').css('display', 'block');
            // countDown();
        }
    }
}

$('.did_verify_btn').on('click', async function () {
    g_mnemonic = String($('.recovery_phrase_textarea').val());
    console.origin.log('---g_mnemonic:', g_mnemonic)
    let mnemonicR = cyfs.bip39.validateMnemonic(g_mnemonic);
    console.origin.log("gen mnemonicR:", mnemonicR);
    if(!mnemonicR){
        toast({
            message: 'Recovery Phrase Validation Error',
            time: 1500,
            type: 'warn'
        });
        return;
    }
    if(g_token && g_ip){
        let peopleInfo = {
            area: new cyfs.Area(0 ,0,0,0),
            mnemonic: g_mnemonic,
            network: cyfs.get_current_network(),
            address_index: _calcIndex(g_uniqueId),
            name: undefined,
            icon:undefined
        }
        console.origin.log("peopleInfo:", peopleInfo);
        let peopleRet = await resetDid.createPeople(peopleInfo);
        console.origin.log("peopleRet:", peopleRet);
        if(!peopleRet.err){
            g_peopleInfo = peopleRet;
            // if(peopleRet.object.body_expect().content().ood_list.length < 1){
            //     toast({
            //         message: 'ood list is empty',
            //         time: 1500,
            //         type: 'warn'
            //     });
            //     return;
            // }
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
                    time: 1500,
                    type: 'warn'
                });
                return;
            }else{
                g_deviceInfo = deviceRet;
                let pushOodList = g_peopleInfo.object.body_expect().content().ood_list.push(deviceRet.deviceId);
                let sign_ret = cyfs.sign_and_set_named_object(g_peopleInfo.privateKey, g_peopleInfo.object, new cyfs.SignatureRefIndex(0));
                if (sign_ret.err) {
                    toast({
                        message: 'create device failed',
                        time: 1500,
                        type: 'warn'
                    });
                    return ;
                }
                cyfs.sign_and_push_named_object(g_peopleInfo.privateKey, g_deviceInfo.device, new cyfs.SignatureRefIndex(254)).unwrap();
                await resetDid.upChain();
                bindOod();
            }
        }else{
            toast({
                message: 'Failed to create people',
                time: 1500,
                type: 'warn'
            });
        }
    }else{

    }

})

function countDown () {
    setTimeout(() => {
        if(g_countDown > 0){
            $('.did_bind_success_subtitle_i').html(String(g_countDown - 1));
            g_countDown--;
            countDown();
        }else{
            chrome.runtime.restart();
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





