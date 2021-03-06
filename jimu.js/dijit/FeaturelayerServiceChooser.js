///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  './BasicServiceChooser',
  './FeaturelayerServiceChooserContent'
],
function(declare, _BasicServiceChooser, _FeaturelayerServiceChooserContent) {
  return declare([_BasicServiceChooser], {
    baseClass: 'jimu-featurelayer-service-chooser',
    declaredClass: 'jimu.dijit.FeaturelayerServiceChooser',

    //public methods:
    //getUrl

    //methods to be override:
    //_createServiceChooserContent

    //to be override, return a service chooser content
    _createServiceChooserContent: function(args){
      return new _FeaturelayerServiceChooserContent(args);
    }

  });
});