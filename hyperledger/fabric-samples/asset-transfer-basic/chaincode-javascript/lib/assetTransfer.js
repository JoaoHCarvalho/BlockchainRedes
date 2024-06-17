/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class AssetTransfer extends Contract {

    async InitLedger(ctx) {
        const assets = [
            {
                ID: 'item1',
                Descricao: 'AmostraDeSangue',
                Quantidade: 1,
                Custodiante: 'Dr.Silva',
                Valor: 300,
            },
            {
                ID: 'item2',
                Descricao: 'Impressãodigital',
                Quantidade: 1,
                Custodiante: 'OficialSantos',
                Valor: 400,
            },
            {
                ID: 'item3',
                Descricao: 'SwabDeDNA',
                Quantidade: 2,
                Custodiante: 'TécnicoLima',
                Valor: 500,
            },
            {
                ID: 'item4',
                Descricao: 'Arma',
                Quantidade: 1,
                Custodiante: 'DetetiveSouza',
                Valor: 650,
            },
            {
                ID: 'item5',
                Descricao: 'FilmagemDevigilância',
                Quantidade: 1,
                Custodiante: 'AgentePereira',
                Valor: 700,
            },
            {
                ID: 'item6',
                Descricao: 'Documento',
                Quantidade: 3,
                Custodiante: 'AnalistaOliveira',
                Valor: 800,
            },
        ];

        for (const asset of assets) {
            asset.docType = 'forensicItem';
            await ctx.stub.putState(asset.ID, Buffer.from(stringify(sortKeysRecursive(asset))));
            await this.CriarRegistroDeTransferencia(ctx, asset.ID, asset.Custodiante, 'InitLedger');
        }
    }

    // AdicionarItem em vez de Adicionar
    async AdicionarItem(ctx, id, descricao, quantidade, custodiante, valor) {
        const existe = await this.ItemExiste(ctx, id);
        if (existe) {
            throw new Error(`O item ${id} já existe`);
        }

        const asset = {
            ID: id,
            Descricao: descricao,
            Quantidade: quantidade,
            Custodiante: custodiante,
            Valor: valor,
        };

        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        await this.CriarRegistroDeTransferencia(ctx, id, custodiante, 'AdicionarItem');
        return JSON.stringify(asset);
    }

    // TransferirCustodia em vez de TransferirPosse
    async TransferirCustodia(ctx, id, novoCustodiante) {
        const itemString = await this.LerIndividual(ctx, id);
        const item = JSON.parse(itemString);
        const antigoCustodiante = item.Custodiante;
        item.Custodiante = novoCustodiante;

        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(item))));
        await this.CriarRegistroDeTransferencia(ctx, id, novoCustodiante, 'TransferirCustodia');
        return antigoCustodiante;
    }

    // LerIndividual em vez de ReadAsset
    async LerIndividual(ctx, id) {
        const itemJSON = await ctx.stub.getState(id);
        if (!itemJSON || itemJSON.length === 0) {
            throw new Error(`O item ${id} não existe`);
        }
        return itemJSON.toString();
    }

    async LerTudo(ctx) {
        const todosResultados = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            if (!record.TxID) {  // Filtra apenas os registros de ativos (sem TxID)
                todosResultados.push(record);
            }
            result = await iterator.next();
        }
        return JSON.stringify(todosResultados);
    }
    async LerRegistrosDeCustodia(ctx) {
        const todosResultados = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            if (record.TxID) {  // Filtra apenas os registros de transferência de custódia
                todosResultados.push(record);
            }
            result = await iterator.next();
        }
        return JSON.stringify(todosResultados);
    }
    

    // Função auxiliar para criar um registro de transferência de custodia
    async CriarRegistroDeTransferencia(ctx, itemID, novoCustodiante, tipoTransacao) {
        const timestamp = new Date((await ctx.stub.getTxTimestamp()).seconds.low * 1000).toISOString();
        const registroDeTransferencia = {
            ItemID: itemID,
            Custodiante: novoCustodiante,
            TipoTransacao: tipoTransacao,
            Timestamp: timestamp,
            TxID: ctx.stub.getTxID()
        };
        const registroDeTransferenciaID =`transfer_${itemID}_${ctx.stub.getTxID()}`;
        await ctx.stub.putState(registroDeTransferenciaID, Buffer.from(stringify(sortKeysRecursive(registroDeTransferencia))));
    }

    // Função auxiliar para verificar se um item existe
    async ItemExiste(ctx, id) {
        const itemJSON = await ctx.stub.getState(id);
        return itemJSON && itemJSON.length > 0;
    }
}

module.exports = AssetTransfer;