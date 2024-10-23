#!/bin/bash

# URL to check the state and control the device
URL="http://192.168.1.39/?m=1"

# Function to check the current state of the device
check_state() {
    RESPONSE=$(curl -s "$URL")
    if echo "$RESPONSE" | grep -q ">ON<"; then
        echo "ON"
    else
        echo "OFF"
    fi
}

# Function to control the device
control_device() {
    local TARGET_STATE=$1
    CURRENT_STATE=$(check_state)

    if [[ "$TARGET_STATE" == "on" && "$CURRENT_STATE" == "OFF" ]]; then
        curl -s "$URL&o=1" > /dev/null
        echo "Device turned ON"
    elif [[ "$TARGET_STATE" == "off" && "$CURRENT_STATE" == "ON" ]]; then
        curl -s "$URL&o=0" > /dev/null
        echo "Device turned OFF"
    else
        echo "No action needed, device is already $CURRENT_STATE"
    fi
}

# Check if the parameter is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <on|off>"
    exit 1
fi

# Call the control_device function with the provided parameter
control_device "$1"
