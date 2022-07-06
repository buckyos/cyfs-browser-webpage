import * as cyfs from '../cyfs_sdk/cyfs'
const QRCode = require('qrcode')
import { toast } from './lib/toast.min'
    function getUserAgent() {
        var userAgentInfo = navigator.userAgent;
        var Agents = ["Android", "iPhone"];
        var flagPc = true;
        for (var v = 0; v < Agents.length; v++) {
            if (userAgentInfo.indexOf(Agents[v]) > 0) {
                return (v + 1) * 4;
            }
        }
        return -1;
    }
    var deviceType = getUserAgent();
    var appName = 'com.cyfs.browser$Cyfs Browser';
    let isBindInterval: NodeJS.Timeout | null = null;
    var isBind = false;
    var localIps:string[] = [];
    let access_token:string = '';
    function isUnbind (isActivation:boolean) {
        var url = 'http://127.0.0.1:1321/check';
        var ajax = new XMLHttpRequest();
        ajax.open('get', url, true);
        ajax.send();
        ajax.onreadystatechange = function () {
            if (ajax.readyState == 4 && ajax.status == 200) {
                console.log('JSON.parse(ajax.responseText)', JSON.parse(ajax.responseText))
                const result = JSON.parse(ajax.responseText);
                if (!result.activation) {
                    if(isActivation) {
                        // 未绑定
                        isBind = false;
                        localIps = result.access_info.addrs;
                        access_token = result.access_info.access_token?result.access_info.access_token:'';
                        var params = {
                            "flag": "cyfs",
                            "type": "bindDevice",
                            "data": {
                                "type": 2,
                                "ip": localIps,
                                "access_token": access_token
                            }
                        }
                        QRCode.toCanvas(document.getElementById("scann_code_box_img1"), JSON.stringify(params),{
                            errorCorrectionLevel: 'L',
                            width : 480,
                            height : 480,
                            margin: 0
                        });
                        isBindInterval = setInterval(function(){
                            isUnbind(false);
                        }, 2000);
                    }
                } else {
                    // 已绑定
                    isBind = true;
                    if (isBindInterval) {
                        clearInterval(isBindInterval);
                    }
                    if(!isActivation) {
                        toast({
                            message: "绑定成功",
                            time: 1500,
                            type: 'success'
                        });
                    }
                    window.location.href = 'cyfs://static/mobile/browser.html';
                }
            }
        }
    };
    isUnbind(true);

    var btn = document.getElementById("button1") as HTMLElement;
    btn.onclick = function() {
        console.log("拉起通行证");
        var ipStr = "[";
        for (var i = 0; i < localIps.length; i++) {
            ipStr += localIps[i];
            ipStr += ",";
        }
        ipStr = ipStr.substr(0, ipStr.length-1);
        if (ipStr.length == 0) {
            ipStr = "[127.0.0.1";
        }
        ipStr += "]";
        var locationUrl = "cyfswallet://com.cyfs.wallet?action=bindDevice&ip=" + ipStr + "&app=" + appName + "&type=" + deviceType.toString();
        console.log(locationUrl);
        window.location.href = locationUrl;
    }