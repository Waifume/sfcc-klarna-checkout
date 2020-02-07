/* eslint-disable */
'use strict';

/**
 * This script provides utility functions shared across other checkout scripts.
 * Reused script components for checkout should be contained here, while this
 * script is imported into the requiring script.
 */
importPackage( dw.customer );
importPackage( dw.order );
importPackage( dw.system );
importPackage( dw.util );
importPackage( dw.value );
importPackage( dw.web );
importPackage( dw.catalog );

var Money = require('dw/value/Money');

/**
 * Calculates the amount to be payed by a non-gift certificate payment instrument based
 * on the given basket. The method subtracts the amount of all redeemed gift certificates
 * from the order total and returns this value.
 *
 * PJP-2000: Modified logic to use LineItemCtnr (to support both Basket and Order)
 */
function calculateNonGiftCertificateAmount( lineItemCtnr )
{
	// the total redemption amount of all gift certificate payment instruments in the basket
	var giftCertTotal = new Money( 0.0, lineItemCtnr.currencyCode );

	// get the list of all gift certificate payment instruments
	var gcPaymentInstrs = lineItemCtnr.getGiftCertificatePaymentInstruments();
	var iter = gcPaymentInstrs.iterator();
	var orderPI = null;

	// sum the total redemption amount
	while( iter.hasNext() )
	{
		orderPI = iter.next();
		giftCertTotal = giftCertTotal.add( orderPI.getPaymentTransaction().getAmount() );
	}

	// get the order total
	var orderTotal = lineItemCtnr.totalGrossPrice;

	// calculate the amount to charge for the payment instrument
	// this is the remaining open order total which has to be paid
	var amountOpen = orderTotal.subtract( giftCertTotal );

	// return the open amount
	return amountOpen;
}

/**
 * Determines a unique shipment ID for shipments in the given basket
 * and the given base ID. The function appends a counter to the base ID
 * and checks the existence of the resulting ID. If the resulting ID is
 * unique this ID is returned, if not the counter is incremented and
 * checked again.
 */
function determineUniqueShipmentID( basket, baseID )
{
	var counter = 1;
	var shipment = null;
	var candidateID = baseID + "" + counter;
	while( shipment == null )
	{
		shipment = basket.getShipment(candidateID);
		if( shipment != null )
		{
			// this ID is already taken, increment the counter
			// and try the next one
			counter++;
			candidateID = baseID + "" + counter;
			shipment = null;
		}
		else
		{
			return candidateID;
		}
	}

	// should never go here
	return null;
}

/**
 * Transient representation of a shipping address.
 */
function ShippingAddress()
{
	var UUID = null;

	var ID  = null;
	var firstName = null;
	var lastName = null;
	var address1 = null;
	var address2  = null;
	var city  = null;
	var postalCode = null;
	var stateCode = null;
	var countryCode = null;
	var phone = null;

	/**
	 * The UUID of the reference address. It is set when the attributes
	 * are copied from a given customer or order address and is used
	 * to preselect addresses on a per product line item base.
	 */
	var referenceAddressUUID = null;

	/**
	 * Copies the attributes of this address to the given order address.
	 */
	this.copyTo = function( toAddress )
	{
		toAddress.setFirstName( this.firstName );
		toAddress.setLastName( this.lastName );
		toAddress.setAddress1( this.address1 );
		toAddress.setAddress2( this.address2 );
		toAddress.setCity( this.city );
		toAddress.setPostalCode( this.postalCode );
		toAddress.setStateCode( this.stateCode );
		toAddress.setCountryCode( this.countryCode );
		toAddress.setPhone( this.phone );
	}

	/**
	 * Copies the attributes of a store's address to the given order address.
	 */
	this.storeAddressTo = function(toAddress, storeObject )
	{
		toAddress.setFirstName( '' );
		toAddress.setLastName( storeObject.name );
		toAddress.setAddress1( storeObject.address1 );
		toAddress.setAddress2( storeObject.address2 );
		toAddress.setCity( storeObject.city );
		toAddress.setPostalCode( storeObject.postalCode );
		toAddress.setStateCode( storeObject.stateCode );
		toAddress.setCountryCode( storeObject.custom.countryCodeValue );
		toAddress.setPhone( storeObject.phone );
	}

	/**
	 * Copies the attributes from the given customer address or
	 * order address to this address. The function supports both
	 * copying from CustomerAddress as well as from OrderAddress.
	 */
	this.copyFrom = function( fromAddress )
	{
		// if we copy from a customer address, we set the address ID
		if( fromAddress instanceof CustomerAddress )
		{
			this.ID = fromAddress.ID;
		}

		this.firstName = fromAddress.firstName;
		this.lastName = fromAddress.lastName;
		this.address1 = fromAddress.address1;
		this.address2 = fromAddress.address2;
		this.city = fromAddress.city;
		this.postalCode = fromAddress.postalCode;
		this.stateCode = fromAddress.stateCode;
		this.countryCode = fromAddress.countryCode;
		this.phone = fromAddress.phone;

		if (fromAddress.countryCode.value != null){
			this.countryCode = fromAddress.countryCode.value;
		} else {
			this.countryCode = fromAddress.countryCode;
		}

		// if we copy from a customer address, we set the address ID and UUID
		if(('ID' in fromAddress) && (fromAddress instanceof CustomerAddress || (fromAddress.ID != null && fromAddress.UUID != null)) ){
			this.ID = fromAddress.ID;
			this.referenceAddressUUID = fromAddress.UUID;
		}

		if ('referenceAddressUUID' in fromAddress && fromAddress.referenceAddressUUID != null){
			this.referenceAddressUUID = fromAddress.referenceAddressUUID;
		}
	}

	/**
	*	New function for multi-shipping checkout
	*	Checks if the address already exists in an array of addresses
	*/
	this.addressExists = function (addresses)
	{
		// for each (var address in addresses) {
		// 	if (this.referenceAddressUUID != null && (address.referenceAddressUUID != null)){
		// 		if (this.referenceAddressUUID.equals(address.referenceAddressUUID)){
		// 			return true;
		// 		}
		// 	} else {
		// 		if (this.firstName == address.firstName &&
		// 			this.lastName == address.lastName &&
		// 			this.address1 == address.address1 &&
		// 			this.address2 == address.address2 &&
		// 			this.city == address.city &&
		// 			this.postalCode == address.postalCode &&
		// 			this.stateCode == address.stateCode &&
		// 			this.countryCode == address.countryCode &&
		// 			this.phone == address.phone){
		// 				return true;
		// 			}
		// 	}
		// }

		return false;
	}
}

/**
 * Creates a new transient shipping address in the session dictionary.
 */
function createShippingAddress( referenceAddress )
{
	// create a new in memory address and set the UUID
	var address = new ShippingAddress();
	address.UUID = UUIDUtils.createUUID();

	// get all addresses from session dictionary
	var addresses = session.privacy.shippingAddresses;

	// create an empty array, if no collection was found in session dictionary
	if( addresses == null )
	{
		addresses = new ArrayList();
		session.privacy.shippingAddresses = addresses;
	}

	// add the address to the collection
	addresses.add( address );

	// copy the attribute of the reference address to the transient address


	return address;
}

/**
 * Finds a transient shipping address in the session dictionary
 * and returns the found address.
 */
function findShippingAddress( uuid  )
{
	// check if uuid is set
	if( empty(uuid) )
	{
		return null;
	}

	// get all addresses from session dictionary
	var addresses  = session.privacy.shippingAddresses;

	// check if there are addresses at all
	if( addresses == null || addresses.size() == 0 )
	{
		return null;
	}

	// find the address
	for(var i=0; i<addresses.size(); i++)
	{
		if( uuid.equals(addresses[i].UUID) )
		{
			return addresses[i];
		}
	}

	return null;
}

/**
 * Removes a transient shipping address from the session dictionary.
 */
function removeShippingAddress( shippingAddress )
{
	// check if shippingAddress is set
	if( empty(shippingAddress) )
	{
		return;
	}

	// get all addresses from session dictionary
	var addresses = session.privacy.shippingAddresses;

	// check if there are addresses at all
	if( addresses == null || addresses.size() == 0 )
	{
		return;
	}

	// remove the object from the collection
	addresses.remove( shippingAddress );

	return;
}

/**
 * Determines if the basket already contains payment
 * instruments of the given payment method and removes them from the basket.
 */
function removeExistingPaymentInstruments( lineItemCtnr, method )
{
	// get all credit card payment instruments
	var ccPaymentInstrs  = lineItemCtnr.getPaymentInstruments( method );
	var iter = ccPaymentInstrs.iterator();
	var existingPI  = null;

	// remove them
	while( iter.hasNext() )
	{
		existingPI = iter.next();
		lineItemCtnr.removePaymentInstrument( existingPI );
	}
}

/**
*	New function for multi-shipping checkout
*	Adds a new address to the JSON object of the sessionAddressBook attribute
*/
function addAddressToJSON(jsonAddressBook, referenceAddress) {
	var address = new ShippingAddress();
	var jsonObj = new Object();
	var log = Logger.getLogger("multishipping");

	if (referenceAddress != null){
		// Try to parse incoming JSON string

		if (jsonAddressBook != null){
			try {
				jsonObj = JSON.parse(jsonAddressBook);
			} catch (error){
				log.error(Resource.msgf("multishipping.error.parsejson", "checkout", null, error));
			}
		}

		// Check if JSON object already has addresses
		if (!(jsonObj.addresses instanceof Array)){
			jsonObj.addresses = new Array();
		}

		// Copy referenceAddress to address object to be stringified
		address.copyFrom(referenceAddress);
		address.UUID = referenceAddress.UUID;
		// Add address if not already existing
		if (!address.addressExists(jsonObj.addresses)){
			jsonObj.addresses.push(address);
		}
	}

	return JSON.stringify(jsonObj);
}

/**
*	New function for multi-shipping checkout
*	Updates an address in the JSON sessionAddressBookAttribute
*/
function updateAddressInJSON(jsonAddressBook, referenceAddress) {
	var jsonObj = new Object();
	var addresses = new Array();
	var log = Logger.getLogger("multishipping");

	if (referenceAddress != null && jsonAddressBook != null){
		try {
			jsonObj = JSON.parse(jsonAddressBook);
		} catch (error){
			log.error(Resource.msgf("multishipping.error.parsejson", "checkout", null, error));
			return jsonAddressBook;
		}

		addresses = jsonObj.addresses;

		for (var i = 0; i < addresses.length; i++){
			if (addresses[i].UUID == referenceAddress.UUID){
				referenceAddress.ID = addresses[i].ID;
				referenceAddress.referenceAddressUUID = addresses[i].referenceAddressUUID;
				jsonObj.addresses[i] = referenceAddress;
			}
		}

		return JSON.stringify(jsonObj);
	}
}

/**
*	Returns the addresses stored in the sessionAddressBook attribute as ArrayList.
*/
function getSessionAddresses(basket) {
	var sessionAddressBookObj = new Object();
	var sessionAddressBook = new String();
	var sessionAddresses = new ArrayList();
	var log = Logger.getLogger("multishipping");

	if (!empty(basket.describe().getCustomAttributeDefinition('sessionAddressBook'))){
		sessionAddressBook = basket.custom.sessionAddressBook;

		// Session addresses availability check
		if (sessionAddressBook != null){
			try {
				sessionAddressBookObj = JSON.parse(sessionAddressBook);
				sessionAddresses.add(sessionAddressBookObj.addresses);
			} catch (error){
				log.error(Resource.msgf("multishipping.error.parsejson", "checkout", null, error));
				return null;
			}
		}

		return sessionAddresses;
	}

	return null;
}

/**
*	Helper object to store ProductLineItem information for each quantity.
*	Used in Multi-Shipping Checkout to save creation of new PLIs for each quantity.
*/
function QuantityLineItem() {
	var productID = null;
	var lineItemText = null;
	var quantity = null;
	var pliUUID = null;
	var optionID = null;
}

module.exports = {
    calculateNonGiftCertificateAmount: calculateNonGiftCertificateAmount,
	determineUniqueShipmentID: determineUniqueShipmentID,
	ShippingAddress: ShippingAddress,
	createShippingAddress: createShippingAddress,
	findShippingAddress: findShippingAddress,
	removeShippingAddress: removeShippingAddress,
	removeExistingPaymentInstruments: removeExistingPaymentInstruments,
	addAddressToJSON: addAddressToJSON,
	updateAddressInJSON: updateAddressInJSON,
	getSessionAddresses: getSessionAddresses,
	QuantityLineItem: QuantityLineItem
};
