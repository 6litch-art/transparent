(function(namespace) {

    namespace.replaceHash = function(newHash, triggerHashChange = true, skipIfEmptyIdentifier = true) {

        if(!newHash) newHash = "";
        if (newHash !== "" && (''+newHash).charAt(0) !== '#')
            newHash = '#' + newHash;

        var oldURL = location.origin+location.pathname+location.hash;
        var newURL = location.origin+location.pathname+newHash;

        var fallback  = $(newHash).length === 0;

        var hashElement = $(newHash)[0] ?? undefined;
        if (hashElement !== undefined) // Update hash only if element is displayed
            fallback |= window.getComputedStyle(hashElement)["display"] == "none";

        if((skipIfEmptyIdentifier && !newHash) || fallback){

            dispatchEvent(new HashChangeEvent("hashfallback", {oldURL:oldURL, newURL:newURL}));
            newHash = "";

            oldURL = location.origin+location.pathname+location.hash;
            newURL = location.origin+location.pathname+newHash;
        }

        if(oldURL == newURL) return false;

        var state = Object.assign({}, history.state, {href: newURL});
        history.replaceState(state, '', newURL);

        if(triggerHashChange)
            dispatchEvent(new HashChangeEvent("hashchange", {oldURL:oldURL, newURL:newURL}));

        return true;
    }

})(window);

$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

$.fn.isScrollable  = function()
{
    for (let el of $(this).isScrollableX())
        if(el) return true;

    for (let el of $(this).isScrollableY())
        if(el) return true;

    return false;
}

$.fn.isScrollableX = function() {

    return $(this).map(function(i) {

        var el = this[i] === window ? document.documentElement : this[i];
        var isDom = el == document.documentElement;

        var hasScrollableContent = el.scrollWidth > el.clientWidth;

        var overflowStyle   = window.getComputedStyle(el).overflowX;
        var isOverflowScroll = overflowStyle.indexOf('scroll') !== -1;

        return hasScrollableContent && (isOverflowScroll || isDom);

    }.bind(this));
}

$.fn.isScrollableY = function() {

    return $(this).map(function(i) {

        var el = this[i] === window ? document.documentElement : this[i];
        var isDom = el == document.documentElement;

        var hasScrollableContent = el.scrollHeight > el.clientHeight;

        var overflowStyle   = window.getComputedStyle(el).overflowY;
        var isOverflowScroll = overflowStyle.indexOf('scroll') !== -1;

        return hasScrollableContent && (isOverflowScroll || isDom);

    }.bind(this));
}

$.fn.closestScrollable = function()
{
    return $(this).map((i) => {

        var target = this[i] === window ? document.documentElement : this[i];
        if (target === undefined) target = document.documentElement;

        while (target !== document.documentElement) {

            if($(target).isScrollable()) return target;

            if(target.parentElement === undefined) return undefined;
            if(target.parentElement === null) return null;

            target = target.parentElement;
        }

        return $(target).isScrollable() ? target : undefined;
    });
}

$.fn.repaint = function(duration = 1000, reiteration=5) {

    var time = 0;
    var interval = undefined;
    var fn = function () {

        $(this).each(function (_, el) {

            var displayBak = el.style.display;

            el.style.display = "none";
            el.style.display = displayBak;
            el.offsetHeight;
        });

        if (time > duration) clearInterval(interval);
            time += duration/reiteration;

    }.bind(this);

    fn();
    if(reiteration > 0)
        interval = setInterval(fn, duration/reiteration);
};

;(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Transparent = factory();
    }

})(this, function () {

    var Transparent = {};
        Transparent.version = '0.1.0';

    var Settings = Transparent.settings = {
        "headers": {},
        "data": {},
        "disable": false,
        "global_code": true,
        "debug": true,
        "response_text": {},
        "response_limit": 25,
        "throttle": 1000,
        "identifier": "#page",
        "loader": "#loader",
        "smoothscroll_duration": "200ms",
        "smoothscroll_speed"   : 0,
        "smoothscroll_easing"  : "swing",
        "exceptions": []
    };

    const State = Transparent.state = {

        ROOT       : "transparent",

        SWITCH     : "X-to-Y",
        SAME       : "same",
        READY      : "ready",
        RELOAD     : "reload",
        DISABLE    : "disable",
        LOADING    : "loading",
        NEW        : "new",
        FIRST      : "first",
        SUBMIT     : "submit",
        POPSTATE   : "popstate",
        HASHCHANGE : "hashchange",
        CLICK      : "click",

        PREACTIVE  : "pre-active",
        ACTIVEIN   : "active-in",
        ACTIVE     : "active",
        ACTIVEOUT  : "active-out",
        POSTACTIVE : "post-active",

        NOTIFICATION: "notification"
    };

    var isReady    = false;
    var rescueMode = false;

    Transparent.html = $($(document).find("html")[0]);
    Transparent.html.addClass(Transparent.state.ROOT+ " " + Transparent.state.LOADING + " " + Transparent.state.FIRST);

    if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
        Transparent.html.addClass(Transparent.state.ACTIVE);
        dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
    }

    window.addEventListener("DOMContentLoaded", function()
    {
        Transparent.loader = $($(document).find(Settings.loader)[0] ?? Transparent.html);
    });

    Transparent.isRescueMode = function() { return rescueMode; }
    Transparent.getData = function(uuid)
    {
        return (Settings["data"][uuid] ? Settings["data"][uuid] : {});
    }

    Transparent.setData = function(uuid, data)
    {
        Settings["data"][uuid] = data;
        return this;
    }

    Transparent.getResponseText = function(uuid)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];

        // Bubble up the most recent uuid
        var index = array.indexOf(uuid);
        if (index > -1) {
            array.splice(index, 1);
            array.push(uuid);
        }

        // If no response refresh page based on the requested url
        return sessionStorage.getItem('transparent[response]['+uuid+']') || null;
    }

    Transparent.getResponsePosition = function(uuid)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];

        // Bubble up the most recent uuid
        var index = array.indexOf(uuid);
        if (index > -1) {
            array.splice(index, 1);
            array.push(uuid);
        }

        // If no response refresh page based on the requested url
        var position = sessionStorage.getItem('transparent[position]['+uuid+']');
        return position != "undefined" ? JSON.parse(position) : [];
    }

    Transparent.getResponse = function(uuid)
    {
        return [ Transparent.getResponseText(uuid), Transparent.getResponsePosition(uuid) ];
    }

    function isDomEntity(entity)
    {
        return typeof entity  === 'object' && entity.nodeType !== undefined;
    }

    Transparent.setResponse = function(uuid, responseText, scrollableXY = [], exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
            array.push(uuid);

        while(array.length > Settings["response_limit"])
            sessionStorage.removeItem('transparent['+array.shift()+']');

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponse(uuid, responseText, scrollableXY, true) : this;
        }

        return this;
    }

    Transparent.setResponse = function(uuid, responseText, scrollableXY, exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if( ! (uuid in array) ) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponse(uuid, responseText, scrollableXY, true) : this;
        }

        return this;
    }

    Transparent.setResponseText = function(uuid, responseText, exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if( ! (uuid in array) ) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponseText(uuid, responseText, true) : this;
        }

        return this;
    }

    Transparent.setResponsePosition = function(uuid, scrollableXY, exceptionRaised = false)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if( ! (uuid in array) ) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponsePosition(uuid, scrollableXY, true) : this;
        }

        return this;
    }

    Transparent.hasResponse = function(uuid)
    {
        if(isLocalStorageNameSupported())
            return 'transparent[response]['+uuid+']' in sessionStorage;

        return false;
    }

    Transparent.configure = function (options) {

        var key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
        }

        return this;
    };

    Transparent.ready = function (options = {}) {

        Transparent.configure({'x-ajax-request': true});
        Transparent.configure(options);

        isReady = true;

        dispatchEvent(new Event('transparent:'+Transparent.state.READY));
        Transparent.html.addClass(Transparent.state.READY);

        Transparent.addLayout();

        Transparent.scrollToHash(location.hash, {}, function() {

            Transparent.activeOut(() => Transparent.html.removeClass(Transparent.state.FIRST));
        });

        return this;
    };

    Transparent.addLayout = function() {

        var id = Transparent.getLayout();
        if(id === undefined) return false;

        var isKnown = knownLayout.indexOf(id) !== -1;
        if(!isKnown) knownLayout.push(id);

        return !isKnown;
    }

    Transparent.getLayout = function(dom = null) {

        var layout = dom !== null ? $(dom).find(Settings.identifier) : $(Settings.identifier);
        if(!layout.length) return undefined;

        return layout.data("layout");
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {
            case "FORM":
                var form = $(el);
                return (form.length ? form[0] : undefined);
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form.length ? form[0] : undefined);
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "FORM")
                return Transparent.findNearestForm(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);

            var form = $(el.target).closest("form");
            return (form.length ? form[0] : undefined);
        }

        return null;
    }

    window.previousLocation = window.location.toString();
    Transparent.findLink = function (el) {

        if (el.type == Transparent.state.HASHCHANGE) {

            var href = el.newURL;
            if(!href) return null;

            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var data = history.state ? Transparent.getData(history.state.uuid) : {};
            return ["GET", new URL(el.newURL), data];

        } else if (el.type == Transparent.state.POPSTATE) {

            if(!el.state) return;

            var href = el.state.href;
            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var type = el.state.type;
            var data = Transparent.getData(el.state.uuid);

            var https  = /^https?:\/\//i;
            if (https.test(href)) return [type, new URL(href), data];

            var hash  = /^\#\w*/i;
            if (hash.test(href)) return [type, new URL(location.origin+location.pathname+href), data];

            return [type, new URL(href, location.origin), data];

        } else if(el.type == Transparent.state.SUBMIT) {

            if(el.target && el.target.tagName == "FORM") {

                // Action must be prevented here
                // This is specific to form submission
                el.preventDefault();

                var href = el.target.getAttribute("action");
                if(!href) href = location.pathname + href;

                if (href.startsWith("#")) href = location.pathname + href;
                if (href.endsWith  ("#")) href = href.slice(0, -1);

                var method = el.target.getAttribute("method") || "GET";
                    method = method.toUpperCase();

                var form = Transparent.findNearestForm(el);
                if (form == null) {
                    console.error("No form found upstream of ", el);
                    return null;
                }

                if(!form.checkValidity()) return null;

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return [method, new URL(href), form];
                return [method, new URL(href, location.origin), form];
            }
        }

        closestEl = $(el).closest("a");
        if(!closestEl.length) closestEl = $(el).closest("button");
        if(!closestEl.length) closestEl = $(el).closest("input");
        if (closestEl.length) el = closestEl[0];
        switch (el.tagName) {

            case "A":
                var href = el.href;
                if(!href) return null;

                if (href.startsWith("#")) href = location.pathname + href;
                if (href.endsWith  ("#")) href = href.slice(0, -1);

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return ["GET", new URL(href), el];

                return ["GET", new URL(href, location.origin), el];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');

                var pathname = el.formAction.replace(domainFormAction, "");
                if(!pathname) return null;

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit") {

                    var form = Transparent.findNearestForm(el);
                    if (form == null) {
                        console.error("No form found upstream of ", el);
                        return null;
                    }

                    if(!form.checkValidity()) return null;

                    var pat  = /^https?:\/\//i;
                    if (pat.test(href)) return ["POST", new URL(pathname), form];
                    return ["POST", new URL(pathname, location.origin), form];
                }
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "A" && el.target.href)
                return Transparent.findLink(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);
        }

        // Try to catch a custom href attribute without "A" tag
        if (el.target && $(el.target).attr("href")) {

            var href = $(el.target).attr("href");
            if(!href) return null;

            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var form = Transparent.findNearestForm(el);
            if (form == null) return null;

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return ["GET", new URL(href), form];
            return ["GET", new URL(href, location.origin), form];
        }

        if (el.target && el.target.parentElement)
            return  Transparent.findLink(el.target.parentElement);

        return null;
    };


    Transparent.preload = function (link, callback = function(preload = []) {}) {

        var nPreload = 0;
        for (var as in link) {

            link[as] = link[as].filter(url => url !== null && url.length > 0);
            nPreload += link[as].length;
        }

        if(nPreload == 0)
            return callback();

        var preloads = [];
        var nPreloaded = 0;
        for (var as in link) {

            for (var i = 0; i < link[as].length; i++) {

                var url = link[as][i];
                if(url === null || url === "") continue;

                var preload = document.createElement("link");
                    preloads.push(preload);

                    preload.onload = function () {

                        if (++nPreloaded == nPreload)
                            return callback(preloads);
                    };

                    preload.setAttribute("rel", "preload");
                    preload.setAttribute("as", as);
                    preload.setAttribute("crossorigin","");
                    preload.href = url;

                    document.head.append(preload);
            }
        }
    }

    Transparent.findElementFromParents = function(el, parents, from = -1) {

        var that = $(el).find(Settings.identifier);
        for (var i = parents.length - 1, j = 0; i >= 0; i--) {

            if (j++ < from) continue;

            var that = that.children(parents[i].tagName);
            if (that.length != 1) return undefined;
        }

        return that;
    }

    Transparent.isPage = function(dom) {

        // Check if page block found
        var page = $(dom).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        return true;
    }

    var knownLayout = [];
    Transparent.isKnownLayout = function(dom)
    {
        var page = (dom ? $(dom).find(Settings.identifier) : $(Settings.identifier))[0];
        if (page === undefined) return false;

        var layout = $(page).data("layout");
        return knownLayout.indexOf(layout) !== -1;
    }

    Transparent.isCompatibleLayout = function(dom, method = null, data = null)
    {
        // If no html response.. skip
        if(!dom) return false;

        // An exception applies here..
        // in case the page contains data transferred to the server
        if(method == "POST" && !jQuery.isEmptyObject(data)) return true;

        var page = $(dom).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        var currentPage = $(Settings.identifier)[0] || undefined;
        if (currentPage === undefined) return false;

        var name  = currentPage.dataset.name || "default";
        var prevName = page.dataset.prevName || name;

        var layout = currentPage.dataset.layout;
        var prevLayout = page.dataset.prevLayout || layout;

        return name == prevName && layout == prevLayout;
    }

    Transparent.parseDuration = function(str) {

        var array = String(str).split(", ");
            array = array.map(function(t) {

                if(String(t).endsWith("ms")) return parseFloat(String(t))/1000;
                return parseFloat(String(t));
            });

        return Math.max(...array);
    }

    Transparent.callback = function(fn = function() {}, delay = 0) {

        if(delay == 0) fn();
        else setTimeout(fn, delay);
    }

    Transparent.activeTime = function(el = undefined) {

        var delay = 0, duration = 0;
        if(el === undefined)
            el = Transparent.loader[0];

        var style = window.getComputedStyle(el);
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        var style = window.getComputedStyle(el, ":before");
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        var style = window.getComputedStyle(el, ":after");
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        return {delay:delay, duration:duration};
    }

    Transparent.activeIn = function(activeCallback = function() {}) {

        if(!Transparent.html.hasClass(Transparent.state.PREACTIVE)) {
            Transparent.html.addClass(Transparent.state.PREACTIVE);
            dispatchEvent(new Event('transparent:'+Transparent.state.PREACTIVE));
        }

        var active = Transparent.activeTime();

        Transparent.html.removeClass(Transparent.state.PREACTIVE);
        if(!Transparent.html.hasClass(Transparent.state.ACTIVEIN)) {
            Transparent.html.addClass(Transparent.state.ACTIVEIN);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVEIN));
        }

        Transparent.callback(function() {

            Transparent.html.removeClass(Transparent.state.ACTIVEIN);
            if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
                Transparent.html.addClass(Transparent.state.ACTIVE);
                dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
            }

            var active = Transparent.activeTime();
            Transparent.callback(function() {

                activeCallback();

            }.bind(this), active.duration);

        }.bind(this), active.delay);
    }

    Transparent.activeOut = function(activeCallback = function() {}) {

        if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
            Transparent.html.addClass(Transparent.state.ACTIVE);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
        }

        if(!Transparent.html.hasClass(Transparent.state.ACTIVEOUT)) {
            Transparent.html.addClass(Transparent.state.ACTIVEOUT);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVEOUT));
        }

        var active = Transparent.activeTime();
        Transparent.callback(function() {

            activeCallback();
            Transparent.html.removeClass(Transparent.state.ACTIVE);

            var active = Transparent.activeTime();
            Transparent.callback(function() {

                Transparent.html.removeClass(Transparent.state.ACTIVEOUT);
                if(!Transparent.html.hasClass(Transparent.state.POSTACTIVE)){

                    Transparent.html.removeClass(Transparent.state.POSTACTIVE);
                    dispatchEvent(new Event('transparent:'+Transparent.state.POSTACTIVE));
                }

                if(Transparent.html.hasClass(Transparent.state.LOADING)) {

                    dispatchEvent(new Event('transparent:load'));

                    Object.values(Transparent.state).forEach(e => Transparent.html.removeClass(e));
                    Transparent.html.addClass(Transparent.state.ROOT + " " + Transparent.state.READY);

                } else {

                    Transparent.html.removeClass(Transparent.state.POSTACTIVE);
                }

            }, active.duration);

        }.bind(this), active.delay);
    }

    Transparent.replaceCanvases = function(dom) {

        // Extract existing canvas to avoid redrawing them.. (time consuming)
        $.each($('html').find("canvas"), function () {

            var parent = $(this).parent();
            if(!parent.length) return;

            var id = this.getAttribute("id");
            if (id) {

                var canvas = $(dom).find("#page #" + id);
                canvas.replaceWith(this);

            } else {

                if(dom === undefined)
                    console.alert("Response missing..");

                var parent = Transparent.findElementFromParents(dom, $(this).parents(), 3);
                if (parent === undefined) {
                    console.error("Unexpected canvas without ID found..", this)
                    return false;
                }

                parent.append(this);
            }
        });
    }

    Transparent.evalScript = function(el)
    {
        function scriptCloneEl(el){
            var script  = document.createElement("script");
            script.text = el.innerHTML;

            var i = -1, attrs = el.attributes, attr;
            var N = attrs.length;
            while ( ++i < N ) {
                script.setAttribute( (attr = attrs[i]).name, attr.value );
            }

            eval($(script).text());
            return script;
        }

        if (el.tagName === 'SCRIPT' ) el.parentNode.replaceChild( scriptCloneEl(el) , el );
        else {

            var i = -1, children = el.childNodes;
            var N = children.length;
            while ( ++i < N ) {
                Transparent.evalScript( children[i] );
            }
        }

        return el;
    }

    Transparent.rescue = function(dom)
    {
        console.error("Rescue mode.. called");
        rescueMode = true;

        document.head.innerHTML = $(dom).find("head").html();
        document.body.innerHTML = $(dom).find("body").html();

        Transparent.evalScript($("head")[0]);
        Transparent.evalScript($("body")[0]);
    }

    Transparent.userScroll = function(el = undefined) { return $(el === undefined ? document.documentElement : el).closestScrollable().prop("user-scroll") ?? true; }
    Transparent.scrollTo = function(dict, el = window, callback = function() {})
    {
        el = $(el).length ? $(el)[0] : window;
        if (el === window  )
            el = document.documentElement;
        if (el === document)
            el = document.documentElement;

        var cancelable = dict["cancelable"] ?? false;
        if(cancelable && $(el).prop("cancel")) $(el).stop();

        if(!Transparent.userScroll(el)) {

            if($(el).prop("cancelable")) {

                $(el).prop("user-scroll", true);
                $(el).stop();
            }

            return;
        }

        $(el).prop("user-scroll", false);
        if(cancelable) {

            $(el).prop("cancelable", true);
            $(el).on("scroll.userscroll mousedown.userscroll wheel.userscroll DOMMouseScroll.userscroll mousewheel.userscroll touchmove.userscroll", function(e) {
                $(this).prop("user-scroll", true);
            });
        }

        var maxScrollX = $(el).prop("scrollWidth") - Math.round($(el).prop("clientWidth"));
        if (maxScrollX == 0) maxScrollX = Math.round($(el).prop("clientWidth"));
        var maxScrollY = $(el).prop("scrollHeight") - Math.round($(el).prop("clientHeight"));
        if (maxScrollY == 0) maxScrollY = Math.round($(el).prop("clientHeight"));

        scrollTop  = Math.max(0, Math.min(dict["top"] ?? $(el).prop("scrollTop"), maxScrollY));
        scrollLeft = Math.max(0, Math.min(dict["left"] ?? $(el).prop("scrollLeft"), maxScrollX));

        speed    = parseFloat(dict["speed"] ?? 0);
        easing   = dict["easing"] ?? "swing";
        debounce = dict["debounce"] ?? 0;

        duration  = 1000*Transparent.parseDuration(dict["duration"] ?? 0);
        durationX = 1000*Transparent.parseDuration(dict["duration-x"] ?? dict["duration"] ?? 0);
        durationY = 1000*Transparent.parseDuration(dict["duration-y"] ?? dict["duration"] ?? 0);

        if(speed) {

            var currentScrollX = $(el)[0].scrollLeft;
            if(currentScrollX < scrollLeft || scrollLeft == 0) // Going to the right
                distanceX = Math.abs(scrollLeft - currentScrollX);
            else // Going back to 0 position
                distanceX = currentScrollX;

            var currentScrollY = $(el)[0].scrollTop;
            if(currentScrollY <= scrollTop || scrollTop == 0) // Going to the right
                distanceY = Math.abs(scrollTop - currentScrollY);
            else // Going back to 0 position
                distanceY = currentScrollY;

            durationX = speed ? 1000*distanceX/speed : durationX;
            durationY = speed ? 1000*distanceY/speed : durationY;
            duration = durationX+durationY;
        }

        var callbackWrapper = function() {

            if(cancelable)
                $(el).off("scroll.user mousedown.user wheel.user DOMMouseScroll.user mousewheel.user touchmove.user", () => null);

            el.dispatchEvent(new Event('scroll'));
            callback();

            $(el).prop("user-scroll", true);
        };

        if(duration == 0) {

            el.scrollTo(scrollLeft, scrollTop);
            el.dispatchEvent(new Event('scroll'));
            callback();

            $(el).prop("user-scroll", true);

        } else {

            $(el).animate({scrollTop: scrollTop}, durationY, easing,
                () => $(el).animate({scrollLeft: scrollLeft}, durationX, easing, Transparent.debounce(callbackWrapper, debounce))
            );
        }

        return this;
    }

    Transparent.debounce = function(func, wait, immediate) {

        var timeout;

        return function() {

            var context = this, args = arguments;
            var later = function() {

                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            var callNow = immediate && !timeout;
            clearTimeout(timeout);

            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };


    Transparent.findImages = function () {

        var doc = document.documentElement;
        const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i
        return Array.from(doc.querySelectorAll('*'))
            .reduce((collection, node) => {

            let prop = window.getComputedStyle(node, null).getPropertyValue('background-image')
            let match = srcChecker.exec(prop);
            if (match) collection.add(match[1]);

            if (/^img$/i.test(node.tagName)) collection.add(node.src)
            else if (/^frame$/i.test(node.tagName)) {

                try {
                    searchDOM(node.contentDocument || node.contentWindow.document)
                        .forEach(img => { if (img) collection.add(img); })
                } catch (e) {}
            }

            return collection;

        }, new Set());
    }

    var memory = [];
    Transparent.fileLoaded = [];
    Transparent.inMemory = function(el) {

        // TO BE DONE. (PRELOAD IMAGES ON PRIORITY)
        // FORCE LOADING IF IMAGE IS NOT MANDATORY
        if(element in memory) return true;

        $(el).each(function() {

            var isImage = this.tagName == "IMG";
            console.log(isImage);

            $(this).addClass('fadein');
            $(this).on('load.transparent', function() {

                $(this).removeClass('fadein');

                iImages++;
                console.log(this.src, iImages, nImages);
                if(iImages >= nImages) {
                    console.log("YAY !");
                }
            });
        });
    }

    Transparent.loadImages = function()
    {
        function loadImg (src, timeout = 500) {
            var imgPromise = new Promise((resolve, reject) => {

                let img = new Image()
                    img.onload = () => {
                    resolve({
                        src: src,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    })
                }

                img.onerror = reject
                img.src = src
            })

            var timer = new Promise((resolve, reject) => { setTimeout(reject, timeout) })
            return Promise.race([imgPromise, timer])
        }

        function loadImgAll (imgList, timeout = 500) {
            return new Promise((resolve, reject) => {
                Promise.all(imgList
                    .map(src => loadImg(src, timeout))
                    .map(p => p.catch(e => false))
                ).then(results => resolve(results.filter(r => r)))
            })
        }

        return new Promise((resolve, reject) => {
            loadImgAll(Array.from(Transparent.findImages(document.documentElement))).then(resolve, reject)
        })
    }

    Transparent.transferAttributes = function(dom) {

        var html = $(dom).find("html");
        $($("html")[0].attributes).each(function(i, attr) { 
            if(attr.name == "class") return;
            $("html").removeAttr(attr.name);
        });

        $($(html)[0].attributes).each(function(i, attr) {
            if(attr.name == "class") return;
            $("html").attr(attr.name, attr.value);
        });

        var head = $(dom).find("head");
        $($("head")[0].attributes).each(function(i, attr) { 
            $("head").removeAttr(attr.name);
        });

        $($(head)[0].attributes).each(function(i, attr) {
            $("head").attr(attr.name, attr.value);
        });

        var body = $(dom).find("body");
        $($("body")[0].attributes).each(function(i, attr) { 
            $("body").removeAttr(attr.name);
        });
        $($(body)[0].attributes).each(function(i, attr) {
            $("body").attr(attr.name, attr.value);
        });
    }

    Transparent.onLoad = function(uuid, dom, callback = null, scrollTo = false) {

        window.previousHash     = window.location.hash;
        window.previousLocation = window.location.toString();
        if(callback === null) callback = function() {};

        // Transfert attributes
        Transparent.transferAttributes(dom);
        
        // Replace head..
        var head = $(dom).find("head");
        $("head").children().each(function() {

            var el   = this;
            var found = false;

            head.children().each(function() {

                found = this.isEqualNode(el);
                return !found;
            });

            if(!found) this.remove();
        });

        head.children().each(function() {

            var el   = this;
            var found = false;

            $("head").children().each(function() { found |= this.isEqualNode(el); });
            if(!found) {

                if(this.tagName != "SCRIPT" || Settings["global_code"] == true) $("head").append(this.cloneNode(true));
                else $("head").append(this);
            }
        });

        // Replace canvases..
        Transparent.replaceCanvases(dom);

        // Extract page block to be loaded
        var page = $(dom).find(Settings.identifier);
        var oldPage = $(Settings.identifier);

        // Make sure name/layout keep the same after a page change (tolerance for POST or GET requests)
        if  (page.data("name") == oldPage.data("name")) page.removeData("prevName");
        else page.data("prevName", oldPage.data("name"));

        if(oldPage.data("layout") != undefined && page.data("layout") != undefined) {

            var switchLayout = Transparent.state.SWITCH.replace("X", page.data("layout")).replace("Y", oldPage.data("layout"));
            page.data("prevLayout", oldPage.data("layout"));
        }

        var states = Object.values(Transparent.state);
        var     htmlClass = Array.from(($(dom).find("html").attr("class") || "").split(" ")).filter(x => !states.includes(x));
        var  oldHtmlClass = Array.from(($(Transparent.html).attr("class") || "").split(" "));
        var removeHtmlClass = oldHtmlClass.filter(x => !htmlClass.includes(x) && switchLayout != x && !states.includes(x));

        Transparent.html.removeClass(removeHtmlClass).addClass(htmlClass);
        $(page).insertBefore(oldPage);

        oldPage.remove();
        
        if(Settings["global_code"] == true) Transparent.evalScript($(page)[0]);
        dispatchEvent(new Event('DOMContentLoaded'));

        Transparent.addLayout();

        if(scrollTo) {

            // Go back to top of the page..
            var scrollableElements   = Transparent.getScrollableElement();
            var scrollableElementsXY = Transparent.getResponsePosition(uuid);

            for(i = 0; i < scrollableElements.length; i++) {

                var el = scrollableElements[i];
                var positionXY = undefined;
                if(scrollableElementsXY.length == scrollableElements.length)
                    positionXY = scrollableElementsXY[i] || undefined;

                if(el == window || el == document.documentElement) {

                    if(positionXY != undefined) Transparent.scrollTo({top:positionXY[0], left:positionXY[1], duration:0, cancelable: false});
                    else if (location.hash) Transparent.scrollToHash(location.hash, {duration:0});
                    else Transparent.scrollTo({top:0, left:0, duration:0, cancelable: false});

                } else {

                    if(positionXY != undefined) Transparent.scrollTo({top:positionXY[0], left:positionXY[1], duration:0, cancelable: false}, el);
                    else Transparent.scrollTo({top:0, left:0, duration:0, cancelable: false}, el);
                }
            }
        }

        $('head').append(function() {

            $(Settings.identifier).append(function() {

                setTimeout(function() {

                    // Callback if needed, or any other actions
                    callback();

                    // Trigger onload event
                    dispatchEvent(new Event('transparent:load'));
                    dispatchEvent(new Event('load'));

                }.bind(this), 1);
            });
        });
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    }

    function isLocalStorageNameSupported() {

        var testKey = 'test', storage = window.localStorage;
        try {

            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return true;

        } catch (error) { return false; }
    }

    Transparent.remToPixel     = function(rem)     { return parseFloat(rem) * parseFloat(getComputedStyle(document.documentElement).fontSize); }
    Transparent.emToPixel      = function(em, el)  { return parseFloat(em ) * parseFloat(getComputedStyle(el.parentElement).fontSize); }
    Transparent.percentToPixel = function(p , el)  { return parseFloat(p  ) * el.outerWidth(); }
    Transparent.parseToPixel   = function(str, el) {

        if(str === undefined) return undefined;

        var array = String(str).split(", ");
            array = array.map(function(s) {

                     if(s.endsWith("rem")) return Transparent.remToPixel    (s);
                else if(s.endsWith("em") ) return Transparent.emToPixel     (s, el);
                else if(s.endsWith("%")  ) return Transparent.percentToPixel(s, el);
                return parseFloat(s);
            });

        return Math.max(...array);
    }

    Transparent.getScrollPadding = function(el = document.documentElement) {

        var style  = window.getComputedStyle(el);
        var dict = {};
            dict["top"   ] = Transparent.parseToPixel(style["scroll-padding-top"   ] || 0, el);
            dict["left"  ] = Transparent.parseToPixel(style["scroll-padding-left"  ] || 0, el);
            dict["right" ] = Transparent.parseToPixel(style["scroll-padding-right" ] || 0, el);
            dict["bottom"] = Transparent.parseToPixel(style["scroll-padding-bottom"] || 0, el);

        if(isNaN(dict["top"   ])) dict["top"]    = 0;
        if(isNaN(dict["left"  ])) dict["left"]   = 0;
        if(isNaN(dict["right" ])) dict["right"]  = 0;
        if(isNaN(dict["bottom"])) dict["bottom"] = 0;

        return dict;
    }

    Transparent.scrollToHash = function(hash = window.location.hash, options = {}, callback = function() {}, el = window)
    {
        if (hash !== "") {

            if ((''+hash).charAt(0) !== '#')
                hash = '#' + hash;

            var hashElement = $(hash)[0] ?? undefined;
            if (hashElement !== undefined) {

                var scrollTop  = hashElement.getBoundingClientRect().top  + document.documentElement.scrollTop - Transparent.getScrollPadding().top;
                var scrollLeft = hashElement.getBoundingClientRect().left + document.documentElement.scrollTop - Transparent.getScrollPadding().left;

                options = Object.assign({duration: Settings["smoothscroll_duration"], speed: Settings["smoothscroll_speed"]}, options, {left:scrollLeft, top:scrollTop});
            }

            var bottomReach = document.body.scrollHeight - (window.scrollY + window.innerHeight) < 1;
            var bottomOverflow = scrollTop > window.scrollY + window.innerHeight;
        }

        if(hash === "" || (bottomReach && bottomOverflow)) callback({}, el);
        else Transparent.scrollTo(options, el, callback);

        return this;
    }

    Transparent.isElement = function(obj){
        try { return Boolean(obj.constructor.__proto__.prototype.constructor.name); }
        catch(e) { return false; }
    };

    Transparent.getScrollableElement = function(el = document.documentElement)
    {
        return $(el).find('*').add(el).filter(function() { return $(this).isScrollable(); });
    };

    Transparent.getScrollableElementXY = function() {

        var elementsXY = [];
        var elements = Transparent.getScrollableElement();

        for(i = 0; i < elements.length; i++)
            elementsXY.push([$(elements[i]).scrollTop(), $(elements[i]).scrollLeft()]);

        return elementsXY;
    }

    function __main__(e) {

        // Disable transparent JS (e.g. during development..)
        if(Settings.disable) return;

        // Determine link
        const link = Transparent.findLink(e);
        if   (link == null) return;
        
        dispatchEvent(new CustomEvent('transparent:link', {link:link}));

        const uuid   = uuidv4();
        const type   = link[0];
        const url    = link[1];

        var target = Transparent.isElement(link[2]) ? link[2] : undefined;
        var data   = Transparent.isElement(link[2]) ? undefined : link[2];

        var form   = target != undefined && target.tagName == "FORM" ? target : undefined;
        if (form) {
            data = $(form).serialize();
            $(form).find(':submit').attr('disabled', 'disabled');
        }

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        if (e.type != Transparent.state.POPSTATE   &&
            e.type != Transparent.state.HASHCHANGE && !$(this).find(Settings.identifier).length) return;

        // Specific page exception
        for(i = 0; i < Settings.exceptions.length; i++) {

            exception = Settings.exceptions[i];
            if (url.pathname.startsWith(exception)) return;
        }

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != location.origin) return;

        e.preventDefault();

        if (url == location) return;

        if((e.type == Transparent.state.CLICK || e.type == Transparent.state.HASHCHANGE) && url.pathname == location.pathname && url.search == location.search && type != "POST") {

            if(!url.hash) return;
            Transparent.scrollToHash(url.hash ?? "", {easing:Settings["smoothscroll_easing"], duration:Settings["smoothscroll_duration"], speed:Settings["smoothscroll_speed"]}, function() {

                if (e.target != undefined && $(e.target).data("skip-hash") != true)
                    window.replaceHash(url.hash);

            }, $(e.target).closestScrollable());

            return;
        }

        if(e.metaKey && e.altKey) return window.open(url).focus();
        if(e.metaKey && e.shiftKey) return window.open(url, '_blank').focus(); // Safari not focusing..
        if(e.metaKey || $(target).attr("target") == "_blank") return window.open(url, '_blank');

        dispatchEvent(new Event('transparent:onbeforeunload'));
        dispatchEvent(new Event('onbeforeunload'));

        function isJsonResponse(str) {
            try { JSON.parse(str); return true; }
            catch (e) { return false; }
        }

        function handleResponse(uuid, status = 200, method = null, data = null, xhr = null, request = null) {

            responseText  = Transparent.getResponseText(uuid);
            
            var responseURL = xhr.responseURL || url.href;
            if(url.href.substring(0, url.href.indexOf("#")).trimEnd("/") == responseURL.substring(0, responseURL.indexOf("#")).trimEnd("/")  )
                responseURL = url.href; // NB: xhr.responseURL strips away #fragments

            if(!responseText) {

                if(!request && responseText === null) {

                    setTimeout(function() { window.location.href = responseURL; }, Settings["throttle"]);
                    return;
                }

                responseText = request.responseText;
                if(status >= 500) {

                    console.error("Unexpected XHR response from "+uuid+": error code "+request.status);
                    console.error(sessionStorage);
                }

                if(!Transparent.hasResponse(uuid))
                    Transparent.setResponse(uuid, responseText);
            }

            var dom = new DOMParser().parseFromString(responseText, "text/html");
            if(request && request.getResponseHeader("Content-Type") == "application/json") {

                console.log(request);
                if(!isJsonResponse(responseText)) {
                    console.error("Invalid response received for "+ responseURL);                
                    if(Settings.debug) return Transparent.rescue(dom);
                }

                if(form) {
                    $(form).find(':submit').removeAttr('disabled');
                    form.reset();
                }
                
                var response = JSON.parse(responseText);
                if(Settings.debug) console.log(response);

                if(response.code == "302") {
                    
                    if(response.target) location.href = response.target;
                    else location.reload();
                }

                return dispatchEvent(new Event('load'));
            }
 
            // From here the page is valid..
            // so the new page is added to history..
            if(xhr)
                history.pushState({uuid: uuid, status:status, method: method, data: data, href: responseURL}, '', responseURL);

            var dom = new DOMParser().parseFromString(responseText, "text/html");
            if(status != 200) // Blatant error received..
                return Transparent.rescue(dom);

                // Page not recognized.. just go there.. no POST information transmitted..
            if(!Transparent.isPage(dom))        
                return window.location.href = url;

            // Layout not compatible.. needs to be reloaded (exception when POST is detected..)
            if(!Transparent.isCompatibleLayout(dom, method, data))
                return window.location.href = url;

            // Mark layout as known
            if(!Transparent.isKnownLayout(dom)) {

                Transparent.html.addClass(Transparent.state.NEW);
                dispatchEvent(new Event('transparent:'+Transparent.state.NEW));
            }

            // Mark active as popstate or submit
            if(e.type == Transparent.state.POPSTATE) {

                Transparent.html.addClass(Transparent.state.POPSTATE);
                dispatchEvent(new Event('transparent:'+Transparent.state.POPSTATE));

            } else if(e.type == Transparent.state.SUBMIT) {

                Transparent.html.addClass(Transparent.state.SUBMIT);
                dispatchEvent(new Event('transparent:'+Transparent.state.SUBMIT));
            }

            // Callback active
            var prevLayout = Transparent.getLayout();
            var newLayout = Transparent.getLayout(dom);
            if(prevLayout == newLayout)
                Transparent.html.addClass(Transparent.state.SAME);

            var switchLayout = Transparent.state.SWITCH.replace("X", prevLayout).replace("Y", newLayout);
            Transparent.html.addClass(switchLayout);

            dispatchEvent(new Event('transparent:'+switchLayout));

            if($(dom).find("html").hasClass(Transparent.state.RELOAD))
                window.location.reload();

            Transparent.html.addClass(Transparent.state.LOADING);

            return Transparent.activeIn(function() {

                $(Transparent.html).prop("user-scroll", true);
                if($(dom).find("html").hasClass(Transparent.state.RELOAD))
                    return; // Reload state found..

                Transparent.onLoad(uuid, dom, function() {

                    Transparent.activeOut(function() {

                        Transparent.html
                            .removeClass(switchLayout)
                            .removeClass(Transparent.state.SUBMIT)
                            .removeClass(Transparent.state.POPSTATE)
                            .removeClass(Transparent.state.NEW);
                    });

                }, type != "POST");
            });
        }

        if(history.state && !Transparent.hasResponse(history.state.uuid))
                Transparent.setResponse(history.state.uuid, Transparent.html[0], Transparent.getScrollableElementXY());

        // This append on user click (e.g. when user push a link)
        // It is null when dev is pushing or replacing state
        var addNewState = !e.state;
        if (addNewState) {

            if(history.state)
                Transparent.setResponsePosition(history.state.uuid, Transparent.getScrollableElementXY());
            
            $(Transparent.html).prop("user-scroll", false); // make sure to avoid page jump during transition (cancelled in activeIn callback)

            // Submit ajax request..
            var xhr = new XMLHttpRequest();
            return jQuery.ajax({
                url: url.href,
                type: type,
                data: data,
                dataType: 'html',
                headers: Settings["headers"] || {},
                xhr: function () { return xhr; },
                success: function (html, status, request) { return handleResponse(uuid, request.status, type, data, xhr, request); },
                error:   function (request, ajaxOptions, thrownError) { return handleResponse(uuid, request.status, type, data, xhr, request); }
            });
        }

        return handleResponse(history.state.uuid, history.state.status, history.state.method, history.state.data);
    }

    // Update history if not refreshing page or different page (avoid double pushState)
    var href = history.state ? history.state.href : null;
    if (href != location.origin + location.pathname + location.hash)
        history.replaceState({uuid: uuidv4(), status: history.state ? history.state.status : 200, data:{}, method: history.state ? history.state.method : "GET", href: location.origin + location.pathname + location.hash}, '', location.origin + location.pathname + location.hash);

    // Overload onpopstate
    if(Settings.disable) {

        var states    = Object.values(Transparent.state);
        var htmlClass = Array.from(($("html").attr("class") || "").split(" ")).filter(x => !states.includes(x));
        Transparent.html.removeClass(states).addClass(htmlClass.join(" ")+" "+Transparent.state.ROOT+" "+Transparent.state.READY+" "+Transparent.state.DISABLE);

    } else {

        window.onpopstate   = __main__; // Onpopstate pop out straight to previous page.. this creates a jump while changing pages with hash..
        window.onhashchange = __main__;
        document.addEventListener('click', __main__, false);

        $("form").submit(__main__);
    }

    return Transparent;
});
