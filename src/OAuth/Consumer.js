function OAuthConsumer(options) {  
    var name = 'oauth';
    
    this.oauth_version = '1.0';
    this.signature_method = 'PLAINTEXT';
    
    this.consumer_token;
    this.access_token;
    
    this.cookie;
    
    this.getName = function () {
        return name;
    };
    
    this.init = function(options) {
        // default to using cookies
        this.use_cookies = options.use_cookies == false ? false : true;
        
        this.debug = options.debug == false ? false : true;
        
        this.consumer_token = new OAuthToken(options.key, options.secret);
        this.access_token = new OAuthToken(options.token_key, options.token_secret);

        this.callback_url = options.callback_url || 'oob';

        this.oauth_verifier = options.oauth_verifier || '';
        
        this.onauthorized = options.onauthorized;
        
        if (options.use_cookies) {
            this.cookie = new OAuthCookie('oauth_token_' + this.getName());
            var values = this.cookie.getValue().split('|');
            if (values) {
                this.access_token.set(values[0], values[1]);
                this.oauth_verifier = values[2];
            }
        }
    };
    
    this.authorize = function(){
        if (!(this.access_token.key && this.access_token.secret)) {
            // need to get a access token
            this.getRequestToken();
        }
        
        if (this.access_token.key && this.access_token.secret && !this.oauth_verifier) {
            var url = this.authorizeToken();
            window.open(url);
            var verification = document.createElement('input');
            verification.setAttribute('type', 'text');
            verification.setAttribute('id', 'verification');
            document.body.appendChild(verification);
            
            var button = document.createElement('input');
            button.setAttribute('type', 'button');
            button.setAttribute('id', 'verify');
            button.setAttribute('value', 'Verify');
            document.body.appendChild(button);
            
            var self = this;
            button.onclick = function() {
                var verification = document.getElementById('verification');
                self.oauth_verifier = verification.value;
                self.getAccessToken();
            };
        }
        
        if(this.access_token.key && this.access_token.secret && this.oauth_verifier){
            this.onauthorized.call(this);
        }
    };
    
    this.getRequestToken = function(){
        if (this.debug) {
            netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead UniversalBrowserWrite");
        }
        
        var request = new OAuthRequest({
            method: 'POST', url: this.requestTokenUrl, query: this.getHeaderParams()
        });
		
        var signature = new OAuthConsumer.signatureMethods[this.signature_method]().sign(
            request, this.consumer_token.key, this.access_token.secret
        );
		
		request.setQueryParam('oauth_signature', signature);
		
		var header_string = 'OAuth ' + request.toHeaderString();

        var xhr = new XMLHttpRequest();
        xhr.open(request.getMethod(), request.getUrl(), false);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('Authorization', header_string);
        xhr.send(request+'');
        if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 304)) {
            // oauth_token=hh5s93j4hdidpola&oauth_token_secret=hdhd0244k9j7ao03&
            var token_string_params = xhr.responseText.split('&');
            for (var i = 0; i < token_string_params.length; i++) {
                var param = token_string_params[i].split('=');
                if (param[0] == 'oauth_token') {
                    this.access_token.key = param[1];
                }
                if (param[0] == 'oauth_token_secret') {
                    this.access_token.secret = param[1];
                }
            }
        }
        
        return this;
    };

    this.authorizeToken = function(){
        if (this.debug) {
            netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead UniversalBrowserWrite");
        }
        
        return this.authorizationUrl + '?' + this.getRequestString();
    };
    
    this.getAccessToken = function(){
        if (this.debug) {
            netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead UniversalBrowserWrite");
        }
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.accessTokenUrl, false);
        xhr.setRequestHeader('Authorization', this.getHeaderString());
        xhr.send(this.getRequestString());
        if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 304)) {
            // oauth_token=hh5s93j4hdidpola&oauth_token_secret=hdhd0244k9j7ao03&
            var token_string_params = xhr.responseText.split('&');
            for (var i = 0; i < token_string_params.length; i++) {
                var param = token_string_params[i].split('=');
                if (param[0] == 'oauth_token') {
                    this.token = param[1];
                }
                if (param[0] == 'oauth_token_secret') {
                    this.token_secret = param[1];
                }
            }
            
            this.cookie.setValue(this.token + '|' + this.token_secret + '|' + this.oauth_verifier);
        }
        this.authorize();
        return this;
    };
    
    this.getHeaderParams = function () {
        return {
            'realm': this.realm,
            'oauth_callback': this.callback_url,
            'oauth_consumer_key': this.consumer_token.key,
            'oauth_token': this.access_token.key,
            'oauth_signature_method': this.signature_method,
            'oauth_timestamp': this.getTimestamp(),
            'oauth_nonce': this.getNonce(),
            'oauth_verifier': this.oauth_verifier,
            'oauth_version': this.oauth_version
        };
    };
    
    this.getHeaderString = function() {
        var header = [];
        var params = {
            'realm': this.realm,
            'oauth_callback': this.callback_url,
            'oauth_consumer_key': this.key,
            'oauth_token': this.token,
            'oauth_signature_method': this.signature_method,
            'oauth_timestamp': this.getTimestamp(),
            'oauth_nonce': this.getNonce(),
            'oauth_verifier': this.oauth_verifier,
            'oauth_signature': (
                new OAuthConsumer.signatureMethods[this.signature_method]
             ).sign(this.secret, this.token_secret),
            'oauth_version': this.oauth_version
        };
        
        var OU = OAuthUtilities;
        for (var i in params) {
            if (params.hasOwnProperty(i) && params[i]) {
                header.push(OU.urlEncode(i) + '="' + OU.urlEncode(params[i]) + '"');
            }
        }
        
        return 'OAuth ' + header.join(',');
    };
    
    this.getRequestString = function() {
        var request = [];
        var params = {
            'oauth_callback': this.callback_url,
            'oauth_consumer_key': this.key,
            'oauth_token': this.token,
            'oauth_signature_method': this.signature_method,
            'oauth_timestamp': this.getTimestamp(),
            'oauth_nonce': this.getNonce(),
            'oauth_verifier': this.oauth_verifier,
            'oauth_signature': (
                new OAuthConsumer.signatureMethods[this.signature_method]
             ).sign(this.secret, this.token_secret),
            'oauth_version': this.oauth_version
        };
        
        var OU = OAuthUtilities;
        for (var i in params) {
            if (params.hasOwnProperty(i) && params[i]) {
                request.push(OU.urlEncode(i) + '=' + OU.urlEncode(params[i]));
            }
        }
        
        return request.join('&');
    };
    
    this.onauthorized = function(){};
    
    this.getTimestamp = function() {
        return parseInt((new Date).getTime() / 1000) + '';
    };
    
    this.getNonce = function(key_length){
        key_length = key_length || 64;
        
        var key_bytes = key_length / 8;
        var value = '';
        var key_iter = key_bytes / 4;
        var key_remainder = key_bytes % 4;
        var chars = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29', 
                     '2A', '2B', '2C', '2D', '2E', '2F', '30', '31', '32', '33', 
                     '34', '35', '36', '37', '38', '39', '3A', '3B', '3C', '3D', 
                     '3E', '3F', '40', '41', '42', '43', '44', '45', '46', '47', 
                     '48', '49', '4A', '4B', '4C', '4D', '4E', '4F', '50', '51', 
                     '52', '53', '54', '55', '56', '57', '58', '59', '5A', '5B', 
                     '5C', '5D', '5E', '5F', '60', '61', '62', '63', '64', '65', 
                     '66', '67', '68', '69', '6A', '6B', '6C', '6D', '6E', '6F', 
                     '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', 
                     '7A', '7B', '7C', '7D', '7E'];
        
        for (var i = 0; i < key_iter; i++) {
            value += chars[rand()] + chars[rand()] + chars[rand()]+ chars[rand()];
        }
        
        // handle remaing bytes
        for (var i = 0; i < key_remainder; i++) {
            value += chars[rand()];
        }
        
        return value;
        
        function rand() {
            return Math.floor(Math.random() * chars.length);
        }
    };
    
    if (arguments.length > 0) {
        this.init(options);
    }
}


OAuthConsumer.signatureMethods = {};
