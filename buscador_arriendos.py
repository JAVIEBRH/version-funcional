#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Buscador Automatizado de Arriendos - La Florida, Santiago
Autor: Asistente IA
Descripción: Script para encontrar arriendos económicos en La Florida
"""

import requests
import json
import time
import csv
from datetime import datetime
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse
import pandas as pd

class BuscadorArriendos:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.resultados = []
        
    def buscar_portal_inmobiliario(self):
        """Busca en Portal Inmobiliario"""
        print("🔍 Buscando en Portal Inmobiliario...")
        
        # URLs de búsqueda para La Florida
        urls = [
            "https://www.portalinmobiliario.com/venta/departamento/la-florida-metropolitana",
            "https://www.portalinmobiliario.com/arriendo/departamento/la-florida-metropolitana"
        ]
        
        for url in urls:
            try:
                response = requests.get(url, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Buscar propiedades (esto es un ejemplo, necesitarías ajustar los selectores)
                    propiedades = soup.find_all('div', class_='ui-search-result')
                    
                    for prop in propiedades[:10]:  # Limitar a 10 resultados
                        try:
                            titulo = prop.find('h2', class_='ui-search-item__title')
                            precio = prop.find('span', class_='andes-money-amount__fraction')
                            link = prop.find('a', class_='ui-search-item__group__element')
                            
                            if titulo and precio and link:
                                self.resultados.append({
                                    'fuente': 'Portal Inmobiliario',
                                    'titulo': titulo.text.strip(),
                                    'precio': precio.text.strip(),
                                    'link': urljoin(url, link['href']),
                                    'fecha_busqueda': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                })
                        except Exception as e:
                            continue
                            
            except Exception as e:
                print(f"Error en Portal Inmobiliario: {e}")
                
    def buscar_yapo(self):
        """Busca en Yapo.cl"""
        print("🔍 Buscando en Yapo.cl...")
        
        try:
            url = "https://www.yapo.cl/region_metropolitana/arriendo_departamentos_casas/la_florida"
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Buscar anuncios
                anuncios = soup.find_all('tr', class_='ad')
                
                for anuncio in anuncios[:10]:
                    try:
                        titulo_elem = anuncio.find('td', class_='title')
                        precio_elem = anuncio.find('td', class_='price')
                        link_elem = anuncio.find('a')
                        
                        if titulo_elem and precio_elem and link_elem:
                            self.resultados.append({
                                'fuente': 'Yapo.cl',
                                'titulo': titulo_elem.text.strip(),
                                'precio': precio_elem.text.strip(),
                                'link': urljoin(url, link_elem['href']),
                                'fecha_busqueda': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            })
                    except Exception as e:
                        continue
                        
        except Exception as e:
            print(f"Error en Yapo.cl: {e}")
    
    def buscar_mercado_libre(self):
        """Busca en Mercado Libre"""
        print("🔍 Buscando en Mercado Libre...")
        
        try:
            url = "https://inmuebles.mercadolibre.cl/arriendo/departamentos/la-florida-metropolitana"
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Buscar propiedades
                propiedades = soup.find_all('div', class_='ui-search-result')
                
                for prop in propiedades[:10]:
                    try:
                        titulo = prop.find('h2', class_='ui-search-item__title')
                        precio = prop.find('span', class_='andes-money-amount__fraction')
                        link = prop.find('a', class_='ui-search-item__group__element')
                        
                        if titulo and precio and link:
                            self.resultados.append({
                                'fuente': 'Mercado Libre',
                                'titulo': titulo.text.strip(),
                                'precio': precio.text.strip(),
                                'link': urljoin(url, link['href']),
                                'fecha_busqueda': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            })
                    except Exception as e:
                        continue
                        
        except Exception as e:
            print(f"Error en Mercado Libre: {e}")
    
    def extraer_precio_numerico(self, precio_texto):
        """Extrae el precio numérico del texto"""
        if not precio_texto:
            return 0
            
        # Buscar números en el texto
        numeros = re.findall(r'[\d,]+', precio_texto.replace('.', ''))
        if numeros:
            # Tomar el primer número encontrado
            precio_limpio = numeros[0].replace(',', '')
            try:
                return int(precio_limpio)
            except:
                return 0
        return 0
    
    def ordenar_por_precio(self):
        """Ordena los resultados por precio (más baratos primero)"""
        for resultado in self.resultados:
            resultado['precio_numerico'] = self.extraer_precio_numerico(resultado['precio'])
        
        self.resultados.sort(key=lambda x: x['precio_numerico'])
    
    def guardar_resultados(self):
        """Guarda los resultados en CSV y JSON"""
        if not self.resultados:
            print("❌ No se encontraron resultados")
            return
            
        # Guardar en CSV
        with open('arriendos_la_florida.csv', 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['fuente', 'titulo', 'precio', 'precio_numerico', 'link', 'fecha_busqueda']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for resultado in self.resultados:
                writer.writerow(resultado)
        
        # Guardar en JSON
        with open('arriendos_la_florida.json', 'w', encoding='utf-8') as jsonfile:
            json.dump(self.resultados, jsonfile, ensure_ascii=False, indent=2)
        
        print(f"✅ Se guardaron {len(self.resultados)} resultados en arriendos_la_florida.csv y arriendos_la_florida.json")
    
    def mostrar_mejores_precios(self):
        """Muestra los 10 mejores precios encontrados"""
        if not self.resultados:
            print("❌ No se encontraron resultados")
            return
            
        print("\n" + "="*80)
        print("🏠 TOP 10 ARRIENDOS MÁS ECONÓMICOS EN LA FLORIDA")
        print("="*80)
        
        for i, resultado in enumerate(self.resultados[:10], 1):
            precio = resultado['precio']
            if resultado['precio_numerico'] > 0:
                precio = f"${resultado['precio_numerico']:,} CLP"
            
            print(f"\n{i}. {resultado['titulo']}")
            print(f"   💰 Precio: {precio}")
            print(f"   📍 Fuente: {resultado['fuente']}")
            print(f"   🔗 Link: {resultado['link']}")
            print("-" * 60)
    
    def ejecutar_busqueda_completa(self):
        """Ejecuta la búsqueda completa en todas las fuentes"""
        print("🚀 Iniciando búsqueda automatizada de arriendos en La Florida...")
        print("⏰ Fecha y hora:", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        print()
        
        # Ejecutar búsquedas
        self.buscar_portal_inmobiliario()
        time.sleep(2)  # Pausa para no sobrecargar los servidores
        
        self.buscar_yapo()
        time.sleep(2)
        
        self.buscar_mercado_libre()
        
        # Procesar resultados
        self.ordenar_por_precio()
        self.guardar_resultados()
        self.mostrar_mejores_precios()
        
        print(f"\n✅ Búsqueda completada. Se encontraron {len(self.resultados)} propiedades.")
        print("📁 Los resultados se guardaron en:")
        print("   - arriendos_la_florida.csv")
        print("   - arriendos_la_florida.json")

def main():
    """Función principal"""
    buscador = BuscadorArriendos()
    buscador.ejecutar_busqueda_completa()

if __name__ == "__main__":
    main()







