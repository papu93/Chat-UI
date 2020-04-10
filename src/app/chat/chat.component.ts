import { Component, OnInit } from '@angular/core';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Mensaje } from './models/mensaje';

import { URL_BACKEND } from '../config/config';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit {
  private urlEndPoint: string = URL_BACKEND;

  private client: Client;
  conectado: boolean = false;
  mensaje: Mensaje = new Mensaje();
  mensajes: Mensaje[] = [];

  escribiendo: string;
  clienteId: string;

  constructor() {
    //Generamos un valor unico. Quitando la parte entera que genera el Math.random().
    this.clienteId = 'id-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2);
  }

  ngOnInit() {
    this.client = new Client();
    this.client.webSocketFactory = ()=> {
      //Le asignamos la ruta que definimos en el broker(Spring)
      return new SockJS(this.urlEndPoint + "/chat-websocket");
    }

    //Escuchar cuando nos conectamos o desconectamos
    this.client.onConnect = (frame) => {
      console.log('Conectados: ' + this.client.connected + ' : ' + frame);
      this.conectado = true;

      //Se suscribe a chat/mensaje y escuchamos cada evento del broker
      this.client.subscribe('/chat/mensaje', e => {
        let mensaje: Mensaje = JSON.parse(e.body) as Mensaje;
        mensaje.fecha = new Date(mensaje.fecha);

        //Si el color no esta definido y el mensaje es de nuevo usuario,
        //y si es el mensaje que se agrego, asigno el color
        if(!this.mensaje.color && mensaje.tipo == 'NUEVO_USUARIO' &&
          this.mensaje.username == mensaje.username) {
            this.mensaje.color = mensaje.color;
        }

        this.mensajes.push(mensaje);
        console.log(mensaje);
      });

      //Nos suscribimos para escuchar cada vez que alguien este escribiendo
      this.client.subscribe('/chat/escribiendo', e => {
        this.escribiendo = e.body;
        setTimeout(() => this.escribiendo = '', 3000); //Despues de 5 seg no mostramos mas el msj
      });

      console.log(this.clienteId);
      this.client.subscribe('/chat/historial/' + this.clienteId, e => {
        const historial = JSON.parse(e.body) as Mensaje[];
        this.mensajes = historial.map(m => {
          //Convertimos los milisegundos que trae el BK al formato fecha
          m.fecha = new Date(m.fecha);
          return m;
        }).reverse(); //lo damos vuelta, para tener el mas reciente como ultimo
      });

      this.client.publish({destination: '/app/historial', body: this.clienteId});

      this.mensaje.tipo = 'NUEVO_USUARIO';
      this.client.publish({destination: '/app/mensaje', body: JSON.stringify(this.mensaje)});
    }

    this.client.onDisconnect = (frame) => {
      console.log('Desconectados: ' + !this.client.connected + ' : ' + frame);
      //Reseteamos los atributos de la clase
      this.conectado = false;
      this.mensaje = new Mensaje();
      this.mensajes = [];
    }
  }

  conectar(): void {
    this.client.activate(); //Nos conectamos
  }

  desconectar(): void {
    this.client.deactivate(); //Nos desconectamos
  }

  enviarMensaje(): void {
  this.mensaje.tipo = 'MENSAJE';
    this.client.publish({destination: '/app/mensaje', body: JSON.stringify(this.mensaje)});
    this.mensaje.texto = '';
  }

  escribiendoEvento(): void {
    this.client.publish({destination: '/app/escribiendo', body: this.mensaje.username });
  }
}
