sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("mrp.app.controller.Main", {
        onInit: function () {
            this.getView().setModel(new JSONModel({ schedules: [], scenarios: [] }));
            this.loadSchedules();
            this.loadScenarios();
        },

        loadSchedules: function () {
            var oModel = this.getView().getModel();
            fetch('/api/schedules')
                .then(res => res.json())
                .then(data => oModel.setProperty('/schedules', data))
                .catch(err => console.error(err));
        },

        loadScenarios: function () {
            var oModel = this.getView().getModel();
            fetch('/api/scenarios')
                .then(res => {
                    if(!res.ok) throw new Error("Erro na API");
                    return res.json();
                })
                .then(data => {
                    data.unshift({ NR: "ALL", BEZEICHNUNG: "Todos os Cenários" });
                    oModel.setProperty('/scenarios', data);
                })
                .catch(err => {
                    console.error(err);
                    MessageBox.error("Erro ao carregar cenários do BEAS (Verifique a conexão HANA).");
                    // Mock fallback to allow UI testing without db
                    oModel.setProperty('/scenarios', [
                        { NR: "ALL", BEZEICHNUNG: "Todos os Cenários" },
                        { NR: "1", BEZEICHNUNG: "Cenário Demo 1" }
                    ]);
                });
        },

        onOpenAddDialog: function () {
            var oView = this.getView();
            var oDialog = oView.byId("addDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        onCloseAddDialog: function () {
            this.getView().byId("addDialog").close();
        },

        onSaveSchedule: function () {
            var oView = this.getView();
            var scenarioId = oView.byId("scenarioSelect").getSelectedKey();
            var scenarioName = oView.byId("scenarioSelect").getSelectedItem().getText();
            var cronExpression = oView.byId("cronInput").getValue();

            if (!scenarioId || !cronExpression) {
                MessageToast.show("Preencha todos os campos obrigatórios");
                return;
            }

            fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenarioId: scenarioId, scenarioName: scenarioName, cronExpression: cronExpression })
            })
            .then(res => {
                if (!res.ok) throw new Error("Erro ao salvar");
                return res.json();
            })
            .then(data => {
                MessageToast.show("Agendamento criado com sucesso");
                this.loadSchedules();
                this.onCloseAddDialog();
            })
            .catch(err => MessageBox.error("Expressão Cron inválida ou erro no servidor."));
        },

        onDeleteSchedule: function (oEvent) {
            var oItem = oEvent.getSource().getParent();
            var schedule = oItem.getBindingContext().getObject();

            fetch('/api/schedules/' + schedule.id, {
                method: 'DELETE'
            })
            .then(res => res.json())
            .then(data => {
                MessageToast.show("Agendamento removido");
                this.loadSchedules();
            })
            .catch(err => console.error(err));
        }
    });
});
