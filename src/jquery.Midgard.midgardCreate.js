//     Create.js {{ VERSION }} - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // # Create main widget
  //
  // The `midgardCreate` widget is the main entry point into using
  // Create for editing content.
  //
  // While most individual Create widgets can also be used separately,
  // the most common use case is to instantiate `midgardCreate` for
  // your pages and let it handle editables, toolbars, and storate.
  //
  //     jQuery('body').midgardCreate();
  jQuery.widget('Midgard.midgardCreate', {
    // ## Configuration
    //
    // Like most jQuery UI widgets, Create accepts various options 
    // when being instantiated.
    options: {
      // Initial toolbar rendering style: `full` or `minimized`.
      toolbar: 'full',
      // The *Save* jQuery UI button instance.
      saveButton: null,
      // Initial usage state: `browse` or `edit`
      state: 'browse',
      // Whether to highlight editable elements when entering `edit`
      // state.
      highlight: true,
      // Color for the highlights.
      highlightColor: '#67cc08',
      // Widgets to use for editing various content types.
      editorWidgets: {
        default: 'hallo' 
      },
      // Additional editor options.
      editorOptions: {
        hallo: {
          widget: 'halloWidget'
        }
      },
      // Widgets to use for managing collections.
      collectionWidgets: {
        default: 'midgardCollectionAdd'
      },
      // URL callback used with Backbone.sync. Will be passed to the
      // Storage widget.
      url: function () {},
      // Prefix used for localStorage.
      storagePrefix: 'node',
      // Workflow configuration. URL callback is used for retrieving
      // list of workflow actions that can be initiated for an item.
      workflows: {
        url: null
      },
      // Notifications configuration.
      notifications: {},
      // VIE instance used with Create.js. If no VIE instance is passed,
      // Create.js will create its own instance.
      vie: null,
      // URL for the Apache Stanbol service used for annotations, and tag
      // and image suggestions.
      stanbolUrl: null,
      // URL for the DBpedia instance used for finding more information
      // about annotations and tags.
      dbPediaUrl: null,
      // Whether to enable the Tags widget.
      tags: false,
      // Selector for element where Create.js will place its buttons, like
      // Save and Edit/Cancel.
      buttonContainer: '.create-ui-toolbar-statustoolarea .create-ui-statustools',
      // Templates used for UI elements of the Create widget
      templates: {
        buttonContent: '<%= label %> <i class="icon-<%= icon %>"></i>',
        button: '<li id="<%= id %>"><a class="create-ui-btn"><%= buttonContent %></a></li>'
      }
    },

    _create: function () {
      this.vie = this._setupVIE(this.options);

      var widget = this;
      window.setTimeout(function () {
        widget._checkSession();
      }, 10);

      this._enableToolbar();
      this._saveButton();
      this._editButton();
      this._prepareStorage();

      if (this.element.midgardWorkflows) {
        this.element.midgardWorkflows(this.options.workflows);
      }

      if (this.element.midgardNotifications) {
        this.element.midgardNotifications(this.options.notifications);
      }
    },

    destroy: function () {
      // Clean up on widget destruction
      if (this.element.midgardWorkflows) {
        this.element.midgardWorkflows('destroy');
      }
      if (this.element.midgardNotifications) {
        this.element.midgardNotifications('destroy');
      }
      // TODO: use _destroy in jQuery UI 1.9 and above
      jQuery.Widget.prototype.destroy.call(this);
    },

    _setupVIE: function (options) {
      var vie;
      if (options.vie) {
        vie = options.vie;
      } else {
        // Set up our own VIE instance
        var vie = new VIE();
      }

      if (!vie.hasService('rdfa')) {
        vie.use(new vie.RdfaService());
      }

      if (!vie.hasService('stanbol') && options.stanbolUrl) {
        vie.use(new vie.StanbolService({
          proxyDisabled: true,
          url: options.stanbolUrl
        }));
      }

      if (!vie.hasService('dbpedia') && options.dbPediaUrl) {
        vie.use(new vie.DBPediaService({
          proxyDisabled: true,
          url: options.dbPediaUrl
        }));
      }

      return vie;
    },

    _prepareStorage: function () {
      this.element.midgardStorage({
        vie: this.vie,
        url: this.options.url
      });

      var widget = this;
      this.element.bind('midgardstoragesave', function () {
        jQuery('#midgardcreate-save a').html(_.template(widget.options.templates.buttonContent, {
          label: 'Saving',
          icon: 'upload'
        }));
      });

      this.element.bind('midgardstoragesaved midgardstorageerror', function () {
        jQuery('#midgardcreate-save a').html(_.template(widget.options.templates.buttonContent, {
          label: 'Save',
          icon: 'ok'
        }));
      });
    },

    _init: function () {
      this.setState(this.options.state);

      // jQuery(this.element).data('midgardNotifications').showTutorial();
    },

    setState: function (state) {
      this._setOption('state', state);
      if (state === 'edit') {
        this._enableEdit();
      } else {
        this._disableEdit();
      }
      this._setEditButtonState(state);
    },

    showNotification: function (options) {
      if (this.element.midgardNotifications) {
        return this.element.midgardNotifications('create', options);
      }
    },

    configureEditor: function (name, widget, options) {
      this.options.editorOptions[name] = {
        widget: widget,
        options: options
      };
    },

    setEditorForContentType: function (type, editor) {
      if (this.options.editorOptions[editor] === undefined && editor !== null) {
        throw new Error("No editor " + editor + " configured");
      }
      this.options.editorWidgets[type] = editor;
    },

    setEditorForProperty: function (property, editor) {
      if (this.options.editorOptions[editor] === undefined && editor !== null) {
        throw new Error("No editor " + editor + " configured");
      }
      this.options.editorWidgets[property] = editor;
    },

    _checkSession: function () {
      if (!window.sessionStorage) {
        return;
      }

      var toolbarID = this.options.storagePrefix + 'Midgard.create.toolbar';
      if (sessionStorage.getItem(toolbarID)) {
        this._setOption('toolbar', sessionStorage.getItem(toolbarID));
      }

      var stateID = this.options.storagePrefix + 'Midgard.create.state';
      if (sessionStorage.getItem(stateID)) {
        this.setState(sessionStorage.getItem(stateID));
      }

      this.element.bind('midgardcreatestatechange', function (event, options) {
        sessionStorage.setItem(stateID, options.state);
      });
    },

    _saveButton: function () {
      if (this.options.saveButton) {
        return this.options.saveButton;
      }
      jQuery(this.options.buttonContainer, this.element).append(jQuery(_.template(this.options.templates.button, {
        id: 'midgardcreate-save',
        buttonContent: _.template(this.options.templates.buttonContent, {
          label: 'Save',
          icon: 'ok'
        })
      })));
      this.options.saveButton = jQuery('#midgardcreate-save', this.element);
      this.options.saveButton.hide();
      return this.options.saveButton;
    },

    _editButton: function () {
      var widget = this;
      jQuery(this.options.buttonContainer, this.element).append(jQuery(_.template(this.options.templates.button, {
        id: 'midgardcreate-edit',
        buttonContent: ''
      })));
      jQuery('#midgardcreate-edit', this.element).bind('click', function () {
        if (widget.options.state === 'edit') {
          widget.setState('browse');
          return;
        }
        widget.setState('edit');
      });
    },

    _setEditButtonState: function (state) {
      var buttonContents = {
        edit: _.template(this.options.templates.buttonContent, {
          label: 'Cancel',
          icon: 'remove'
        }),
        browse: _.template(this.options.templates.buttonContent, {
          label: 'Edit',
          icon: 'edit'
        })
      };
      var editButton = jQuery('#midgardcreate-edit a', this.element);
      if (!editButton) {
        return;
      }
      if (state === 'edit') {
        editButton.addClass('selected');
      }
      editButton.html(buttonContents[state]);
    },

    _enableToolbar: function () {
      var widget = this;
      this.element.bind('midgardtoolbarstatechange', function (event, options) {
        if (window.sessionStorage) {
          sessionStorage.setItem(widget.options.storagePrefix + 'Midgard.create.toolbar', options.display);
        }
        widget._setOption('toolbar', options.display);
      });

      this.element.midgardToolbar({
        display: this.options.toolbar,
        vie: this.vie
      });
    },

    _enableEdit: function () {
      this._setOption('state', 'edit');
      var widget = this;
      var editableOptions = {
        toolbarState: widget.options.display,
        disabled: false,
        vie: widget.vie,
        widgets: widget.options.editorWidgets,
        editors: widget.options.editorOptions,
        collectionWidgets: widget.options.collectionWidgets
      };
      if (widget.options.enableEditor) {
        editableOptions[enableEditor] = widget.options.enableEditor;
      }
      if (widget.options.disableEditor) {
        editableOptions[disableEditor] = widget.options.disableEditor;
      }
      jQuery('[about]', this.element).each(function () {
        var element = this;
        if (widget.options.highlight) {
          var highlightEditable = function (event, options) {
              if (!jQuery(options.element).is(':visible')) {
                // Hidden element, don't highlight
                return;
              }
              if (options.entityElement.get(0) !== element) {
                // Propagated event from another entity, ignore
                return;
              }

              // Highlight the editable
              options.element.effect('highlight', {
                color: widget.options.highlightColor
              }, 3000);
            };

          jQuery(this).bind('midgardeditableenableproperty', highlightEditable);
        }
        jQuery(this).bind('midgardeditabledisable', function () {
          jQuery(this).unbind('midgardeditableenableproperty', highlightEditable);
        });

        if (widget.options.tags) {
          jQuery(this).bind('midgardeditableenable', function (event, options) {
            if (event.target !== element) {
              return;
            }
            jQuery(this).midgardTags({
              vie: widget.vie,
              entityElement: options.entityElement,
              entity: options.instance
            });
          });
        }

        jQuery(this).midgardEditable(editableOptions);
      });

      this._trigger('statechange', null, {
        state: 'edit'
      });
    },

    _disableEdit: function () {
      var widget = this;
      var editableOptions = {
        disabled: true,
        vie: widget.vie,
        editorOptions: widget.options.editorOptions
      };
      jQuery('[about]', this.element).each(function () {
        jQuery(this).midgardEditable(editableOptions);
        jQuery(this).removeClass('ui-state-disabled');
      });
      this._setOption('state', 'browse');
      this._trigger('statechange', null, {
        state: 'browse'
      });
    }
  });
})(jQuery);
