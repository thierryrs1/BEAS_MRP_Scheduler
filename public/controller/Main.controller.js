sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("mrp.app.controller.Main", {
        _editingId: null,

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
                    oModel.setProperty('/scenarios', [
                        { NR: "ALL", BEZEICHNUNG: "Todos os Cenários" },
                        { NR: "1", BEZEICHNUNG: "Cenário Demo 1" }
                    ]);
                });
        },

        onOpenAddDialog: function () {
            this._editingId = null;
            var oView = this.getView();
            var oDialog = oView.byId("addDialog");
            if (oDialog) {
                oDialog.setTitle("Novo Agendamento");
                oView.byId("timePicker").setValue("");
                
                oView.byId("chkMon").setSelected(true);
                oView.byId("chkTue").setSelected(true);
                oView.byId("chkWed").setSelected(true);
                oView.byId("chkThu").setSelected(true);
                oView.byId("chkFri").setSelected(true);
                oView.byId("chkSat").setSelected(false);
                oView.byId("chkSun").setSelected(false);

                oDialog.open();
            }
        },

        onEditSchedule: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent(); 
            var schedule = oItem.getBindingContext().getObject();
            
            this._editingId = schedule.id;
            
            var oView = this.getView();
            var oDialog = oView.byId("addDialog");
            
            oDialog.setTitle("Editar Agendamento");
            oView.byId("scenarioSelect").setSelectedKey(schedule.scenarioId);
            
            // Decodifica a expressão Cron de volta pra tela (minuto hora * * dias)
            var parts = schedule.cronExpression.split(" ");
            var minute = parts[0];
            var hour = parts[1];
            var days = parts[4].split(",");
            
            var timeStr = (hour.length === 1 ? "0"+hour : hour) + ":" + (minute.length === 1 ? "0"+minute : minute);
            oView.byId("timePicker").setValue(timeStr);
            
            oView.byId("chkSun").setSelected(days.includes("0"));
            oView.byId("chkMon").setSelected(days.includes("1"));
            oView.byId("chkTue").setSelected(days.includes("2"));
            oView.byId("chkWed").setSelected(days.includes("3"));
            oView.byId("chkThu").setSelected(days.includes("4"));
            oView.byId("chkFri").setSelected(days.includes("5"));
            oView.byId("chkSat").setSelected(days.includes("6"));

            oDialog.open();
        },

        onCloseAddDialog: function () {
            this.getView().byId("addDialog").close();
            this._editingId = null;
        },

        onSaveSchedule: function () {
            var oView = this.getView();
            var scenarioId = oView.byId("scenarioSelect").getSelectedKey();
            var scenarioName = oView.byId("scenarioSelect").getSelectedItem().getText();
            
            var timeValue = oView.byId("timePicker").getValue();
            var days = [];
            
            if(oView.byId("chkSun").getSelected()) days.push("0");
            if(oView.byId("chkMon").getSelected()) days.push("1");
            if(oView.byId("chkTue").getSelected()) days.push("2");
            if(oView.byId("chkWed").getSelected()) days.push("3");
            if(oView.byId("chkThu").getSelected()) days.push("4");
            if(oView.byId("chkFri").getSelected()) days.push("5");
            if(oView.byId("chkSat").getSelected()) days.push("6");

            if (!scenarioId || !timeValue || days.length === 0) {
                MessageToast.show("Preencha o horário e selecione pelo menos um dia.");
                return;
            }

            var timeParts = timeValue.split(":");
            var hour = parseInt(timeParts[0], 10);
            var minute = parseInt(timeParts[1], 10);
            var cronDays = days.join(",");
            
            var cronExpression = minute + " " + hour + " * * " + cronDays;

            var url = '/api/schedules';
            var method = 'POST';
            
            if (this._editingId) {
                url = '/api/schedules/' + this._editingId;
                method = 'PUT';
            }

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenarioId: scenarioId, scenarioName: scenarioName, cronExpression: cronExpression })
            })
            .then(res => {
                if (!res.ok) throw new Error("Erro ao salvar");
                return res.json();
            })
            .then(data => {
                MessageToast.show("Agendamento salvo com sucesso");
                this.loadSchedules();
                this.onCloseAddDialog();
            })
            .catch(err => MessageBox.error("Erro no servidor ao salvar o agendamento."));
        },

        onDeleteSchedule: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
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
        },

        onRunScheduleNow: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var schedule = oItem.getBindingContext().getObject();

            fetch('/api/schedules/' + schedule.id + '/run', {
                method: 'POST'
            })
            .then(res => {
                if(!res.ok) throw new Error("Erro ao iniciar");
                return res.json();
            })
            .then(data => {
                MessageToast.show("Execução de " + schedule.scenarioName + " iniciada agora no servidor!");
            })
            .catch(err => MessageBox.error("Erro ao tentar executar o cenário."));
        }
    });
});
