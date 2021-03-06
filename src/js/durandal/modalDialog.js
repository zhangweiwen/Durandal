﻿define('durandal/modalDialog', ['durandal/composition', 'durandal/system', 'durandal/activator'],
function (composition, system, activator) {

    var contexts = {},
        modalCount = 0;

    function ensureModalInstance(objOrModuleId) {
        return system.defer(function(dfd) {
            if (system.isString(objOrModuleId)) {
                system.acquire(objOrModuleId).then(function (module) {
                    dfd.resolve(new (system.getObjectResolver(module))());
                });
            } else {
                dfd.resolve(objOrModuleId);
            }
        }).promise();
    }

    var modalDialog = {
        currentZIndex: 1050,
        getNextZIndex: function () {
            return ++this.currentZIndex;
        },
        isModalOpen: function() {
            return modalCount > 0;
        },
        getContext: function(name) {
            return contexts[name || 'default'];
        },
        addContext: function(name, modalContext) {
            modalContext.name = name;
            contexts[name] = modalContext;

            var helperName = 'show' + name.substr(0, 1).toUpperCase() + name.substr(1);
            this[helperName] = function (obj, activationData) {
                return this.show(obj, activationData, name);
            };
        },
        createCompositionSettings: function(obj, modalContext) {
            var settings = {
                model:obj,
                activate:false
            };

            if (modalContext.documentAttached) {
                settings.documentAttached = modalContext.documentAttached;
            }

            return settings;
        },
        show: function(obj, activationData, context) {
            var that = this;
            var modalContext = contexts[context || 'default'];

            return system.defer(function(dfd) {
                ensureModalInstance(obj).then(function(instance) {
                    var modalActivator = activator.create();

                    modalActivator.activateItem(instance, activationData).then(function (success) {
                        if (success) {
                            var modal = instance.modal = {
                                owner: instance,
                                context: modalContext,
                                activator: modalActivator,
                                close: function () {
                                    var args = arguments;
                                    modalActivator.deactivateItem(instance, true).then(function (closeSuccess) {
                                        if (closeSuccess) {
                                            modalCount--;
                                            modalContext.removeHost(modal);
                                            delete instance.modal;
                                            dfd.resolve.apply(dfd, args);
                                        }
                                    });
                                }
                            };

                            modal.settings = that.createCompositionSettings(instance, modalContext);
                            modalContext.addHost(modal);

                            modalCount++;
                            composition.compose(modal.host, modal.settings);
                        } else {
                            dfd.resolve(false);
                        }
                    });
                });
            }).promise();
        }
    };

    modalDialog.addContext('default', {
        blockoutOpacity: .2,
        removeDelay: 200,
        addHost: function(modal) {
            var body = $('body');
            var blockout = $('<div class="modalBlockout"></div>')
                .css({ 'z-index': modalDialog.getNextZIndex(), 'opacity': this.blockoutOpacity })
                .appendTo(body);

            var host = $('<div class="modalHost"></div>')
                .css({ 'z-index': modalDialog.getNextZIndex() })
                .appendTo(body);

            modal.host = host.get(0);
            modal.blockout = blockout.get(0);

            if (!modalDialog.isModalOpen()) {
                modal.oldBodyMarginRight = $("body").css("margin-right");
                
                var html = $("html");
                var oldBodyOuterWidth = body.outerWidth(true);
                var oldScrollTop = html.scrollTop();
                $("html").css("overflow-y", "hidden");
                var newBodyOuterWidth = $("body").outerWidth(true);
                body.css("margin-right", (newBodyOuterWidth - oldBodyOuterWidth + parseInt(modal.oldBodyMarginRight)) + "px");
                html.scrollTop(oldScrollTop); // necessary for Firefox
            }
        },
        removeHost: function(modal) {
            $(modal.host).css('opacity', 0);
            $(modal.blockout).css('opacity', 0);

            setTimeout(function() {
                $(modal.host).remove();
                $(modal.blockout).remove();
            }, this.removeDelay);
            
            if (!modalDialog.isModalOpen()) {
                var html = $("html");
                var oldScrollTop = html.scrollTop(); // necessary for Firefox.
                html.css("overflow-y", "").scrollTop(oldScrollTop);
                $("body").css("margin-right", modal.oldBodyMarginRight);
            }
        },
        documentAttached: function (child, context) {
            var $child = $(child);
            var width = $child.width();
            var height = $child.height();

            $child.css({
                'margin-top': (-height / 2).toString() + 'px',
                'margin-left': (-width / 2).toString() + 'px'
            });

            $(context.model.modal.host).css('opacity', 1);

            if ($(child).hasClass('autoclose')) {
                $(context.model.modal.blockout).click(function() {
                    context.model.modal.close();
                });
            }

            $('.autofocus', child).each(function() {
                $(this).focus();
            });
        }
    });

    return modalDialog;
});