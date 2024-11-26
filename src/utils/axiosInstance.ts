import * as vscode from 'vscode';
import axios from 'axios';

export function getAxiosInstance(pat: string) {
    return axios.create({
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
        }
    });
}