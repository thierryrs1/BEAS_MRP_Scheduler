sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("mrp.app.controller.Login", {
        onInit: function () {
            var oModel = new JSONModel({ dbName: "Carregando..." });
            this.getView().setModel(oModel);

            fetch('/api/config')
                .then(res => res.json())
                .then(data => {
                    oModel.setProperty("/dbName", data.dbName);
                })
                .catch(err => {
                    oModel.setProperty("/dbName", "Banco Desconhecido");
                });
        },

        onLoginPress: function () {
            var user = this.getView().byId("userInput").getValue();
            var pass = this.getView().byId("passwordInput").getValue();

            if (!user || !pass) {
                MessageToast.show("Informe usuário e senha");
                return;
            }

            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                    oRouter.navTo("RouteMain");
                } else {
                    MessageBox.error(data.error || "Erro no login");
                }
            })
            .catch(err => {
                MessageBox.error("Erro ao conectar com servidor de login.");
            });
        }
    });
});
