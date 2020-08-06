import {object, number, array, string, boolean} from '@hapi/joi';

const block = object().keys({
	index: number(),
	prevHash: string().length(94),
	time: number(),
	transactions: array().items(object().keys({
		multihash: string(),
		size: number()
	})),
	nonce: number(),
	hash: string().length(128)
});

const transaction = object().keys({
	id: string().hex().length(64),
	time: number(),
	reward: string(),
	script: string(),
	inputs: array().items(object().keys({
		tx: string().hex().length(64),
		index: number(),
		amount: number(),
		address: string(),
		signature: string().hex()
	})),
	outputs: array().items(object().keys({
		index: number(),
		amount: number(),
		address: string()
	})),
});

const schemas = {
	block,
	transaction,
};

export const validate = (schema, data) =>  schemas[schema].validate(data);

export const isValid = (schema, data) => {
	console.log(validate(schema, data));
	return Boolean(!validate(schema, data).error)
};