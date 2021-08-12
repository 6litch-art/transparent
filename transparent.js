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
        "response_text": {},
    };

    var isReady = false;

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
        return sessionStorage.getItem('transparent['+uuid+']') || null;
    }

    Transparent.setResponseText = function(uuid, responseText)
    {
        sessionStorage.setItem('transparent['+uuid+']', responseText);
        return this;
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

        if(Transparent.addLayout()) // Return true if layout is added
            Transparent.showPage();

        $("form").submit(__main__);

        isReady = true;
        dispatchEvent(new Event('transparent:ready'));

        return this;
    };

    Transparent.addLayout = function() {

        var layout = $("#page")[0].getAttribute("layout");
        var isKnown = knownLayout.indexOf(layout) !== -1;
        if(!isKnown) knownLayout.push(layout);

        return !isKnown;
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {
            case "FORM":
                var form = $(el);
                return (form ? form.serializeObject() : {});
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form ? form.serializeObject() : {});
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
            return (form ? form.serializeObject() : {});
        }

        return {};
    }

    window.popStateOld = document.location.pathname;
    Transparent.findLink = function (el) {

        if (el.type == "popstate") {
            
            // Custom action when manipulating user history
            if(!el.state)
                return (window.popStateNew != window.popStateOld ? history.go(-1) : null);

            var href = el.state.href;
            var type = el.state.type;
            var data = Transparent.getData(el.state.uuid);

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return [type, new URL(href), data];
            return [type, new URL(href, location.origin), data];

        } else if(el.type == "submit") {

            if(el.target && el.target.tagName == "FORM") {

                // Action must be prevented here
                // This is specific to form submission
                el.preventDefault();

                var href = el.target.getAttribute("action");
                if(href == null) href = location.pathname;
                if(href.startsWith("#")) href = location.pathname + href;

                var method = el.target.getAttribute("method") || "GET";
                    method = method.toUpperCase();

                var data = Transparent.findNearestForm(el);

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return [method, new URL(href), data];
                return [method, new URL(href, location.origin), data];
            }
        }

        switch (el.tagName) {

            case "A":
                var href = el.getAttribute("href");
                if(href == null) return null;
                if(href.startsWith("#")) href = location.pathname + href;

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return ["GET", new URL(href), Transparent.findNearestForm(el)];

                return ["GET", new URL(href, location.origin), Transparent.findNearestForm(el)];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');
                var pathname = el.formAction.replace(domainFormAction, "");
                if(pathname == null) return null;

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit") {

                    var pat  = /^https?:\/\//i;
                    if (pat.test(href)) return ["POST", new URL(pathname), Transparent.findNearestForm(el)];
                    return ["POST", new URL(pathname, location.origin), Transparent.findNearestForm(el)];
                }
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "A" && el.target.getAttribute("href"))
                return Transparent.findLink(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);
        }

        // Try to catch a custom href attribute without "A" tag
        if (el.target && el.target.getAttribute("href")) {

            var href = el.target.getAttribute("href");
            if(href == null) return null;
            if(href.startsWith("#")) href = location.pathname + href;

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return ["GET", new URL(href), Transparent.findNearestForm(el)];
            return ["GET", new URL(href, location.origin), Transparent.findNearestForm(el)];
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

        var that = $(el).find("#page");
        for (var i = parents.length - 1, j = 0; i >= 0; i--) {

            if (j++ < from) continue;

            var that = that.children(parents[i].tagName);
            if (that.length != 1) return undefined;
        }

        return that;
    }

    Transparent.isPage = function(htmlResponse) {

        // Check if page block found
        var page = $(htmlResponse).find("#page");
        if (!page.length) return false;

        return true;
    }

    var knownLayout = [];
    Transparent.isKnownLayout = function(htmlResponse)
    {
        var page = (htmlResponse ? $(htmlResponse).find("#page") : $("#page"));
        if (!page.length) return false;

        var layout = $(page)[0].getAttribute("layout");
        return knownLayout.indexOf(layout) !== -1;
    }

    Transparent.isCompatibleLayout = function(htmlResponse, method = null, data = null)
    {
        // If no html response.. skip
        if(!htmlResponse) return false;

        // An exception applies here..
        // in case the page contains data transfered to the server
        if(method && !jQuery.isEmptyObject(data)) return true;

        var page = $(htmlResponse).find("#page");
        if (!page.length) return false;

        var currentPage = $("#page");
        if (!currentPage.length) return false;

        var name = $(page)[0].getAttribute("name");
        var currentName = $(currentPage)[0].getAttribute("name");

        return name == currentName;
    }

    Transparent.showPage = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $("#page").css("visibility", "visible");
            $("#page").css("opacity", 1);
            callback();

        } else {

            $("#page").animate({opacity:1}, delay);
            setTimeout(callback, delay);
        }
    }

    Transparent.hidePage = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $("#page").css("visibility", "hidden");
            $("#page").css("opacity", 0);
            callback();

        } else {

            $("#page").animate({opacity:0}, delay);
            setTimeout(callback, delay);
        }
    }

    Transparent.replaceCanvases = function(htmlResponse) {

        // Extract existing canvas to avoid redrawing them.. (time consuming)
        $.each($('html').find("canvas"), function () {

            var parent = $(this).parent();
            if(!parent.length) return;

            var id = this.getAttribute("id");
            if (id) {

                var canvas = $(htmlResponse).find("#page #" + id);
                canvas.replaceWith(this);

            } else {

                if(htmlResponse === undefined)
                    console.alert("htmlResponse missing..");

                var parent = Transparent.findElementFromParents(htmlResponse, $(this).parents(), 3);
                if (parent === undefined) {
                    console.error("Unexpected canvas without ID found..", this)
                    return false;
                }

                parent.append(this);
            }
        });
    }


    Transparent.onLoad = function(htmlResponse, callback = null, scrollTo = true) {

        if(callback === null) callback = function() {};

        // Replace canvases
        Transparent.replaceCanvases(htmlResponse);

        // Replace head..
        var head = $(htmlResponse).find("head");
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

            $("head").children().each(function() {
                found = this.isEqualNode(el);
                return !found;
            });

            if(!found) $("head").append(this);
        });

        // Extract page block to be loaded
        var page = $(htmlResponse).find("#page");
        var oldPage = $("#page");

        // Make sure name keep the same, after a page change when POST or GET called
        page[0].setAttribute("name", oldPage[0].getAttribute("name"));

        // Apply changes
        $(page).insertBefore(oldPage);
        oldPage.remove();

        if(Transparent.addLayout()) {
            $(page).css("visibility", "hidden");
            $(page).css("opacity", 0);
        } else {
            $(page).css("visibility", "visible");
            $(page).css("opacity", 1);
        }

        var currentScroll = window.scrollY;
        $('head').append(function() {
            $('#page').append(function() {

                    // Callback if needed, or any other action (e.g. call for showPage..)
                callback();

                // Trigger onload event
                dispatchEvent(new Event('load'));

                // Go back to top of the page..
                if(scrollTo && window.location.hash === "") {

                    if(currentScroll == window.scrollY)
                        window.scrollTo({top: 0, behavior: 'auto'});
                }
            });
        });
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

    function __main__(e) {

        // Determine link and popState
        window.popStateNew = document.location.pathname;
        const link = Transparent.findLink(e);
        window.popStateOld = document.location.pathname;
        if (link == null) return;

        const uuid = uuidv4();
        const type = link[0];
        const url  = link[1];
        const data = link[2];
        if  (!url) return;

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        // Symfony defaults rejected
        if (url.pathname.startsWith("/_profiler")) return;
        if (url.pathname.startsWith("/_wdt")) return;

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != location.origin) return;
        e.preventDefault();

        if(url.pathname == location.pathname && (url.hash || window.location.hash) && e.type != "popstate" && type != "POST") {
            
            history.replaceState(history.state, ' ');
            if (url.hash) window.location.hash = url.hash;
            return;
        }

        dispatchEvent(new Event('onbeforeunload'));

        function handleResponse(uuid, xhr = null, method = null, data = null) {

            var htmlResponse = document.createElement("html");
            var responseText = Transparent.getResponseText(uuid);
            if(!responseText) {
            
                if(!xhr || !xhr.responseText) {
                    console.error("Unexpected XHR response from "+uuid);
                    console.error(sessionStorage);
                    return;
                }

                responseText = xhr.responseText;
                Transparent.setResponseText(uuid, xhr.responseText);
            }
            $(htmlResponse)[0].innerHTML = responseText;

            // Page not recognized..
            if(!Transparent.isPage(htmlResponse)) {
                $("head").replaceWith($(htmlResponse).find("head"));
                $("body").replaceWith($(htmlResponse).find("body"));
                return;
            }

            // Load new page..
            if(!Transparent.isCompatibleLayout(htmlResponse, method, data))
                return window.location.href = url.href;

            if (Transparent.isKnownLayout(htmlResponse))
                return Transparent.onLoad(htmlResponse, null, addNewState && method != "POST");

            Transparent.hidePage(function() {
                 Transparent.onLoad(htmlResponse, Transparent.showPage, addNewState && method != "POST");
            });
        }

        if(history.state && !Transparent.getResponseText(history.state.uuid))
            Transparent.setResponseText(history.state.uuid, $("html")[0].innerHTML);

        // This append on user click (e.g. when user push a link)
        // It is null when dev is pushing or replacing state
        var addNewState = !e.state;
        if (addNewState) {

            // Submit ajax request..
            var xhr = new XMLHttpRequest();
            return jQuery.ajax({
                url: url.href,
                type: type,
                data: data,
                dataType: 'html',
                headers: Settings["headers"] || {},
                xhr: function () { return xhr; }, 
                success: function (html, status, request) { 
                    history.pushState({uuid: uuid, type: type, data: data, href: xhr.responseURL}, '', xhr.responseURL);
                    return handleResponse(uuid, request, type, data);
                },
                error:   function (request, ajaxOptions, thrownError) { 
                    history.pushState({uuid: uuid, type: type, data: data, href: xhr.responseURL}, '', xhr.responseURL);
                    return handleResponse(uuid, request, type, data);
                }
            });
        }

        return handleResponse(history.state.uuid);
    }

    // Update history if not refreshing page or different page (avoid double pushState)
    var href = history.state ? history.state.href : null;
    if (href != location.pathname+location.hash)
        history.replaceState({uuid: uuidv4(), type: "GET", href: location.pathname+location.hash}, '', location.pathname+location.hash);

    // Overload onpopstate
    window.onpopstate = __main__;
    document.addEventListener('click', __main__, false);

    return Transparent;
});
