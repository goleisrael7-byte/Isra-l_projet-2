export interface InfraArtifact {
  id: string;
  filename: string;
  category: string;
  description: string;
  language: string;
  content: string;
}

export const INFRA_ARTIFACTS: InfraArtifact[] = [
  {
    id: 'pg-schema',
    filename: 'infra/postgres/schema.sql',
    category: 'Base de données PostgreSQL 16',
    description: 'Schéma PostgreSQL complet étendant les tables classes, eleves et notes du Projet 6.',
    language: 'sql',
    content: `-- Schéma PostgreSQL 16 — Plateforme AcademiaHA (Projet 6 Scolarité HA)
CREATE TABLE IF NOT EXISTS filieres (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  nom VARCHAR(120) NOT NULL,
  description TEXT,
  frais_annuels NUMERIC(12,2) NOT NULL DEFAULT 1200000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS niveaux (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  nom VARCHAR(60) NOT NULL,
  ordre INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(50) NOT NULL UNIQUE,
  filiere_id INT REFERENCES filieres(id) ON DELETE SET NULL,
  niveau_id INT REFERENCES niveaux(id) ON DELETE SET NULL,
  annee_academique VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  capacite INT NOT NULL DEFAULT 40,
  salle_principale VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN_SCOLARITE', 'ENSEIGNANT', 'ETUDIANT')),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eleves (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  matricule VARCHAR(30) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  telephone VARCHAR(40),
  date_naissance DATE,
  adresse TEXT,
  contact_urgence VARCHAR(160),
  classe_id INT REFERENCES classes(id) ON DELETE SET NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  eleve_id INT NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  matiere VARCHAR(80) NOT NULL,
  semestre VARCHAR(5) NOT NULL DEFAULT 'S1',
  type_evaluation VARCHAR(20) NOT NULL DEFAULT 'Examen',
  valeur NUMERIC(4,2) NOT NULL CHECK (valeur BETWEEN 0 AND 20),
  publie BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
  },
  {
    id: 'haproxy',
    filename: 'infra/haproxy/haproxy.cfg',
    category: 'Répartition de charge HAProxy',
    description: 'Configuration HAProxy HTTP (app1/app2 sur /health) et TCP PostgreSQL Patroni (port 5000).',
    language: 'cfg',
    content: `global
    log /dev/log local0
    maxconn 4096

defaults
    mode http
    timeout connect 5s
    timeout client  30s
    timeout server  30s

frontend web
    bind *:80
    default_backend apps

backend apps
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server app1 192.168.56.21:3000 check inter 2s fall 2 rise 2
    server app2 192.168.56.22:3000 check inter 2s fall 2 rise 2

listen postgres_primary
    bind *:5000
    mode tcp
    option httpchk GET /primary
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server pg1 192.168.56.31:5432 check port 8008
    server pg2 192.168.56.32:5432 check port 8008`,
  },
  {
    id: 'keepalived',
    filename: 'infra/keepalived/keepalived.conf',
    category: 'VIP VRRP Keepalived',
    description: 'IP Virtuelle flottante 192.168.56.100 entre lb1 (MASTER, 100) et lb2 (BACKUP, 90).',
    language: 'conf',
    content: `vrrp_script chk_haproxy {
    script "/usr/bin/pidof haproxy"
    interval 2
    fall 2
    rise 2
}

vrrp_instance VI_1 {
    state MASTER          # BACKUP sur lb2
    interface eth1
    virtual_router_id 51
    priority 100          # 90 sur lb2
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass secret12
    }
    virtual_ipaddress {
        192.168.56.100/24
    }
    track_script {
        chk_haproxy
    }
}`,
  },
  {
    id: 'vagrantfile',
    filename: 'infra/Vagrantfile',
    category: 'Topologie 6 VMs Vagrant',
    description: 'Déploiement des 6 machines virtuelles Ubuntu 24.04 (lb1, lb2, app1, app2, pg1, pg2).',
    language: 'ruby',
    content: `NODES = {
  "lb1"  => { ip: "192.168.56.11", ram: 512 },
  "lb2"  => { ip: "192.168.56.12", ram: 512 },
  "app1" => { ip: "192.168.56.21", ram: 768 },
  "app2" => { ip: "192.168.56.22", ram: 768 },
  "pg1"  => { ip: "192.168.56.31", ram: 1024 },
  "pg2"  => { ip: "192.168.56.32", ram: 1024 },
}

Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-24.04"
  NODES.each do |name, c|
    config.vm.define name do |node|
      node.vm.hostname = name
      node.vm.network "private_network", ip: c[:ip]
      node.vm.provider "virtualbox" do |vb|
        vb.name = name
        vb.memory = c[:ram]
        vb.cpus = 1
      end
    end
  end
end`,
  },
  {
    id: 'docker-compose',
    filename: 'docker-compose.ha.yml',
    category: 'Conteneurisation Docker HA',
    description: 'Stack multi-instances stateless (app1, app2, haproxy, postgres primary/replica, redis).',
    language: 'yaml',
    content: `services:
  haproxy:
    image: haproxy:2.9-alpine
    ports:
      - "80:80"
    volumes:
      - ./infra/haproxy/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
    depends_on:
      - app1
      - app2

  app1:
    build: .
    environment:
      PORT: "3000"
      INSTANCE_NAME: "app1"
      PG_HOST: "haproxy"
      PG_PORT: "5000"

  app2:
    build: .
    environment:
      PORT: "3000"
      INSTANCE_NAME: "app2"
      PG_HOST: "haproxy"
      PG_PORT: "5000"`,
  },
];
