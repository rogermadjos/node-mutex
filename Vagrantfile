# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "trusty"
  config.vm.box_url = "http://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-i386-vagrant-disk1.box"

  config.vm.network "forwarded_port", guest: 80, host: 3000

  config.vm.provision :shell, :inline => "sudo apt-get update -y && sudo apt-get upgrade -y"
  config.vm.provision :shell, :inline => "sudo apt-get install -y build-essential git nodejs npm redis-server"
  config.vm.provision :shell, :inline => "sudo rm -f /usr/bin/node && sudo cp /usr/bin/nodejs /usr/bin/node"
  config.vm.provision :shell, :inline => "sudo npm install -g istanbul mocha"
  config.vm.provision :shell, :inline => "cd /vagrant && sudo npm install --no-bin-links"
end
